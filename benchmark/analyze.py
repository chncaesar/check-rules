"""
analyze.py — Analyze OpenCode probe runs for rule compliance.

Usage:
    python analyze.py <runs_dir> <tasks.json>

The runs_dir should contain OpenCode JSONL outputs named like:
    T1_k1.jsonl, T1_k2.jsonl, T2_k1.jsonl, ...

Each JSONL file is the --format json output from `opencode run`.
"""

import json
import re
import sys
from pathlib import Path


def load_tasks(tasks_path: str) -> list[dict]:
    with open(tasks_path) as f:
        return json.load(f)


def analyze_run(filepath: Path, task: dict) -> dict:
    """Analyze a single JSONL run file and return compliance results."""
    lines = []
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    lines.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    # Extract tool calls and text outputs
    reads: list[str] = []
    writes: list[str] = []
    texts: list[str] = []

    for d in lines:
        t = d.get("type", "")
        if t == "tool_use":
            p = d.get("part", {})
            tool = p.get("tool", "")
            inp = p.get("state", {}).get("input", {})
            if tool == "read":
                fp = inp.get("filePath", "")
                reads.append(fp.split("/")[-1])
            if tool in ("write", "edit"):
                content = inp.get("content", "") or inp.get("newString", "")
                writes.append(content)
        if t == "text":
            texts.append(d.get("part", {}).get("text", ""))

    all_code = " ".join(writes + texts)
    expected_domains = set(task["domains"])

    # Determine which domain rules were read
    read_file_names = {r.replace(".md", "") for r in reads if r.endswith(".md")}
    hit_domains = list(read_file_names & expected_domains)

    # Check each violation pattern
    violations_found = []
    for vname, vinfo in task["violations"].items():
        pattern = vinfo["pattern"]
        is_reverse = vinfo.get("reverse", False)
        found = bool(re.search(pattern, all_code, re.IGNORECASE))
        if is_reverse and not found:
            violations_found.append(vinfo["desc"])
        elif not is_reverse and found:
            violations_found.append(vinfo["desc"])

    compliant = len(violations_found) == 0
    read_rules = bool(hit_domains)

    return {
        "read_files": list(reads),
        "hit_domains": hit_domains,
        "expected_domains": task["domains"],
        "violations": violations_found,
        "compliant": compliant,
        "read_rules": read_rules,
        "num_lines": len(lines),
    }


def quadrant(result: dict) -> str:
    if result["read_rules"] and result["compliant"]:
        return "Q1: 读了+遵从"
    elif result["read_rules"] and not result["compliant"]:
        return "Q2: 读了+违反"
    elif not result["read_rules"] and result["compliant"]:
        return "Q3: 没读+却遵从"
    else:
        return "Q4: 没读+违反"


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <runs_dir> <tasks.json>")
        sys.exit(1)

    runs_dir = Path(sys.argv[1])
    tasks = load_tasks(sys.argv[2])
    tasks_by_id = {t["id"]: t for t in tasks}

    results: list[dict] = []

    for task_file in sorted(runs_dir.glob("*.jsonl")):
        parts = task_file.stem.split("_k")
        if len(parts) != 2:
            continue
        tid = parts[0]
        k = parts[1]
        task = tasks_by_id.get(tid)
        if not task:
            print(f"Warning: no task definition for {tid}, skipping")
            continue

        result = analyze_run(task_file, task)
        result["task"] = tid
        result["k"] = k
        results.append(result)

    if not results:
        print(f"No JSONL files found in {runs_dir}")
        sys.exit(1)

    # Print table
    header = f"{'Task':6s} {'k':2s} {'lines':5s} {'ReadFiles':40s} {'Hit':6s} {'Comply':6s} {'Violations'}"
    print(header)
    print("-" * len(header))
    for r in results:
        files = " ".join(r["read_files"][:4]) if r["read_files"] else "-"
        hit = "YES" if r["hit_domains"] else "NO"
        comp = "YES" if r["compliant"] else "NO"
        v = "; ".join(r["violations"]) if r["violations"] else "-"
        print(f"{r['task']:6s} {r['k']:<2s} {r['num_lines']:5d} {files:40s} {hit:6s} {comp:6s} {v}")

    # Summary
    print("\n=== Summary by Task ===")
    for tid in sorted(tasks_by_id):
        task_results = [r for r in results if r["task"] == tid]
        if not task_results:
            continue
        reads = sum(1 for r in task_results if r["read_rules"])
        complies = sum(1 for r in task_results if r["compliant"])
        n = len(task_results)
        print(f"  {tid}: read={reads}/{n} comply={complies}/{n}  {tasks_by_id[tid]['description']}")

    total = len(results)
    total_reads = sum(1 for r in results if r["read_rules"])
    total_complies = sum(1 for r in results if r["compliant"])
    print(f"\nOVERALL: read={total_reads}/{total} comply={total_complies}/{total}")

    # Four quadrant
    print("\n=== Four Quadrant ===")
    for r in results:
        q = quadrant(r)
        v = "; ".join(r["violations"]) if r["violations"] else "-"
        print(f"  {r['task']}_k{r['k']} → {q} [{v}]")

    # Cross-tabulation
    q1 = sum(1 for r in results if quadrant(r) == "Q1: 读了+遵从")
    q2 = sum(1 for r in results if quadrant(r) == "Q2: 读了+违反")
    q3 = sum(1 for r in results if quadrant(r) == "Q3: 没读+却遵从")
    q4 = sum(1 for r in results if quadrant(r) == "Q4: 没读+违反")
    print(f"\n=== Quadrant Summary ===")
    print(f"  Q1 (读了+遵从):     {q1}")
    print(f"  Q2 (读了+违反):     {q2} ← 真正的问题:读了规则但不执行")
    print(f"  Q3 (没读+却遵从):   {q3}")
    print(f"  Q4 (没读+违反):     {q4} ← 强制读取插件能对付的")

    print(f"\n读取率: {total_reads}/{total} = {total_reads/total*100:.0f}%")
    print(f"遵从率: {total_complies}/{total} = {total_complies/total*100:.0f}%")


if __name__ == "__main__":
    main()
