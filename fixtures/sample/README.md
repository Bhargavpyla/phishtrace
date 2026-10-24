# Sample dataset (synthetic)

All people, organisations and domains are fictional (`.example`). The configured organisation is `acmecorp.example`.
Labels are the author's expectations, not independently validated ground truth.

- `eval/`: 12 emails, 4 per label (`labels.json` is the answer key; do not pass it to the model).
  Run: `python eval.py fixtures/sample/eval --out results.json` (add `--rules-only` to skip the model).
- `related_group/`: 3 related reports. r1 is the original, r2 repeats its pattern (reusable evidence), r3 changes the destination (fresh checks).
- `manifest.csv`: expected label, expected signals and the reason for each file.

This is a development sample. The sealed evaluation set (written separately, kept hidden from the agent's author) should not reuse these files.
