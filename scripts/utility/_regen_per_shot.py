import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path("scripts/utility").resolve()))
import analyze_ux_screenshots as A  # noqa: E402

REPORT = Path("macro_logs/ux_analysis_unique.json")
UNIQUE = Path("macro_logs/20260818_035706/screenshots_unique")
TARGET = Path("macro_logs/ux_analysis_unique.json")

rep = json.loads(REPORT.read_text(encoding="utf-8"))
shots = rep["screenshots"]
vision = rep.get("vision_analysis", {})
model = rep.get("model", A.MODEL)
client = A.OllamaClient()
print(f"Using model: {model}")

representative = [
    k for k in shots
    if ("02_tabs__" in k or "01_launch__" in k
        or k.endswith("03_results") or k.endswith("99_after_all"))
]
if not representative:
    representative = [k for k in shots if not k.endswith("_pre")]
print(f"Representative shots: {len(representative)}")

per_shot: dict[str, str] = {}
for k in representative:
    feat = shots[k]
    feat_clean = {kk: vv for kk, vv in feat.items() if kk != "vision_description"}
    prompt = A._build_single_shot_analysis_prompt(
        feat.get("label", k), feat_clean, vision.get(k, "")
    )
    img = UNIQUE / f"{k}.png"
    print(f"  analyzing {k}...", end=" ", flush=True)
    per_shot[k] = A.ask_ollama(
        prompt, model=model, client=client, json_schema=A.ANALYSIS_SCHEMA,
        image_path=img if img.exists() else None, system=A.ANALYSIS_SYSTEM,
    )
    print("OK")

agg = "\n".join(f"[{k}]\n{per_shot.get(k, '')}" for k in representative)
summary = A.ask_ollama(
    A._build_analysis_prompt(agg), model=model, client=client,
    json_schema=A.ANALYSIS_SCHEMA, image_path=UNIQUE / "04_scan__03_results.png",
    system=A.AGGREGATE_SYSTEM,
)
code = A.ask_ollama(A._build_code_prompt(summary), model=model, client=client, json_schema=A.CODE_SCHEMA, system=A.CODE_SYSTEM)

# Preserve the better 4b vision/features; restructure recommendations.
rep["analysis_per_screenshot"] = True
rep["combined_model"] = model
rep["ux_recommendations"] = {"per_screenshot": per_shot, "summary": summary}
rep["code_recommendations"] = code
TARGET.write_text(json.dumps(rep, indent=2), encoding="utf-8")
print("\n=== SUMMARY ===\n" + summary)
print("\n=== CODE ===\n" + code)
