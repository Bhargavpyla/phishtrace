"""Trusted triage playbook with TF-IDF retrieval. Only these files can supply guidance to the agent."""
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from schemas import Evidence

PLAYBOOK_DIR = Path(__file__).parent / "playbook"


class Playbook:
    def __init__(self, directory: Path = PLAYBOOK_DIR):
        self.version = (directory / "VERSION").read_text(encoding="utf-8").strip()
        self.passages = []
        for f in sorted(directory.glob("*.md")):
            text = f.read_text(encoding="utf-8").strip()
            self.passages.append({"slug": f.stem, "title": text.splitlines()[0].lstrip("# "), "text": text})
        self._vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self._matrix = self._vec.fit_transform(p["title"] + " " + p["text"] for p in self.passages)

    def search(self, query: str, k: int = 2) -> list[dict]:
        if not query.strip():
            return []
        sims = cosine_similarity(self._vec.transform([query]), self._matrix)[0]
        return [{**self.passages[i], "score": round(float(sims[i]), 3)}
                for i in sims.argsort()[::-1][:k] if sims[i] > 0]

    def as_evidence(self, passage: dict) -> Evidence:
        """Retrieved passages are stored as evidence so an assessment can cite them."""
        return Evidence(id=f"PB-{passage['slug']}", kind="playbook_passage",
                        location=f"playbook/{passage['slug']}.md@{self.version}",
                        value=passage["text"], note=f"Trusted playbook {self.version}.")
