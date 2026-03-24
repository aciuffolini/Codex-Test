"""Tkinter graphical cockpit for Vertical Slice 1."""
from __future__ import annotations

from pathlib import Path
import tkinter as tk
from tkinter import ttk

from controller import CockpitController


class CockpitApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("vNext Slice-1 Cockpit")
        self.root.geometry("840x680")

        self.controller = CockpitController(Path(__file__).resolve().parents[1] / "data" / "slice1-gui-events.json")

        self.observation_var = tk.StringVar()
        self.correction_var = tk.StringVar()
        self.question_var = tk.StringVar()
        self.ask_var = tk.StringVar()
        self.online_var = tk.BooleanVar(value=True)
        self.decision_var = tk.StringVar(value="accepted")

        self.status_text = tk.StringVar(value="Ready")
        self.error_text = tk.StringVar(value="")

        self.visit_id_text = tk.StringVar(value="-")
        self.slice_state_text = tk.StringVar(value="idle")
        self.capture_summary_text = tk.StringVar(value="-")
        self.local_save_text = tk.StringVar(value="not_saved")
        self.sync_status_text = tk.StringVar(value="not_synced")
        self.retrieval_summary_text = tk.StringVar(value="-")
        self.recommendation_text = tk.StringVar(value="-")

        self._build_ui()

    def _build_ui(self) -> None:
        frm = ttk.Frame(self.root, padding=12)
        frm.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frm, text="Vertical Slice 1 Graphical Cockpit", font=("Arial", 14, "bold")).pack(anchor=tk.W)
        ttk.Label(frm, text="Canonical flow only: capture → review/correct → save → sync → retrieve → ask → decide").pack(anchor=tk.W, pady=(0, 10))

        status = ttk.LabelFrame(frm, text="Status", padding=8)
        status.pack(fill=tk.X, pady=4)
        self._kv(status, "Visit ID", self.visit_id_text)
        self._kv(status, "Slice State", self.slice_state_text)
        self._kv(status, "Captured Observation", self.capture_summary_text)
        self._kv(status, "Local Save", self.local_save_text)
        self._kv(status, "Sync", self.sync_status_text)
        self._kv(status, "Retrieval Summary", self.retrieval_summary_text)
        self._kv(status, "Recommendation", self.recommendation_text)

        actions = ttk.LabelFrame(frm, text="Actions", padding=8)
        actions.pack(fill=tk.BOTH, expand=True, pady=4)

        ttk.Button(actions, text="1) Start Visit", command=self.on_start).grid(row=0, column=0, sticky="w", pady=4)

        ttk.Label(actions, text="2) Capture observation").grid(row=1, column=0, sticky="w")
        ttk.Entry(actions, textvariable=self.observation_var, width=70).grid(row=1, column=1, sticky="ew", padx=6)
        ttk.Button(actions, text="Capture", command=self.on_capture).grid(row=1, column=2, padx=4)

        ttk.Label(actions, text="3) Review/Correct").grid(row=2, column=0, sticky="w")
        ttk.Entry(actions, textvariable=self.correction_var, width=70).grid(row=2, column=1, sticky="ew", padx=6)
        ttk.Button(actions, text="Review+Correct", command=self.on_review).grid(row=2, column=2, padx=4)

        ttk.Button(actions, text="4) Save Local", command=self.on_save).grid(row=3, column=0, sticky="w", pady=4)

        ttk.Checkbutton(actions, text="Online sync", variable=self.online_var).grid(row=4, column=0, sticky="w")
        ttk.Button(actions, text="5) Sync", command=self.on_sync).grid(row=4, column=2, sticky="e", padx=4)

        ttk.Label(actions, text="6) Retrieve question").grid(row=5, column=0, sticky="w")
        ttk.Entry(actions, textvariable=self.question_var, width=70).grid(row=5, column=1, sticky="ew", padx=6)
        ttk.Button(actions, text="Retrieve", command=self.on_retrieve).grid(row=5, column=2, padx=4)

        ttk.Label(actions, text="7) Ask/Reason").grid(row=6, column=0, sticky="w")
        ttk.Entry(actions, textvariable=self.ask_var, width=70).grid(row=6, column=1, sticky="ew", padx=6)
        ttk.Button(actions, text="Ask", command=self.on_ask).grid(row=6, column=2, padx=4)

        ttk.Label(actions, text="8) Decision").grid(row=7, column=0, sticky="w")
        ttk.Combobox(actions, textvariable=self.decision_var, values=["accepted", "modified", "rejected"], width=12, state="readonly").grid(row=7, column=1, sticky="w", padx=6)
        ttk.Button(actions, text="Decide", command=self.on_decide).grid(row=7, column=2, padx=4)

        actions.columnconfigure(1, weight=1)

        ttk.Label(frm, textvariable=self.status_text).pack(anchor=tk.W, pady=(8, 2))
        ttk.Label(frm, textvariable=self.error_text, foreground="#b00020", wraplength=780).pack(anchor=tk.W)

    def _kv(self, parent, k: str, var: tk.StringVar) -> None:
        row = ttk.Frame(parent)
        row.pack(fill=tk.X, pady=1)
        ttk.Label(row, text=f"{k}:", width=22).pack(side=tk.LEFT)
        ttk.Label(row, textvariable=var).pack(side=tk.LEFT)

    def _sync_view(self, status: str) -> None:
        st = self.controller.state
        self.visit_id_text.set(st.visit_id or "-")
        self.slice_state_text.set(st.slice_state)
        self.capture_summary_text.set(st.captured_observation or "-")
        self.local_save_text.set(st.local_save_status)
        self.sync_status_text.set(st.sync_status)
        self.retrieval_summary_text.set(st.retrieval_summary or "-")
        self.recommendation_text.set(st.recommendation or "-")
        self.status_text.set(status)
        self.error_text.set(st.last_error)

    def on_start(self):
        _, err = self.controller.safe_call(self.controller.start_visit)
        self._sync_view("Visit started" if not err else "Start failed")

    def on_capture(self):
        _, err = self.controller.safe_call(self.controller.capture, self.observation_var.get())
        self._sync_view("Captured" if not err else "Capture failed")

    def on_review(self):
        _, err = self.controller.safe_call(self.controller.review_correct, self.correction_var.get())
        self._sync_view("Reviewed/corrected" if not err else "Review failed")

    def on_save(self):
        _, err = self.controller.safe_call(self.controller.save_local)
        self._sync_view("Saved locally" if not err else "Save failed")

    def on_sync(self):
        _, err = self.controller.safe_call(self.controller.sync, self.online_var.get())
        self._sync_view("Sync updated" if not err else "Sync failed")

    def on_retrieve(self):
        _, err = self.controller.safe_call(self.controller.retrieve, self.question_var.get())
        self._sync_view("Context retrieved" if not err else "Retrieve failed")

    def on_ask(self):
        _, err = self.controller.safe_call(self.controller.ask, self.ask_var.get())
        self._sync_view("Recommendation ready" if not err else "Ask failed")

    def on_decide(self):
        _, err = self.controller.safe_call(self.controller.decide, self.decision_var.get())
        self._sync_view("Decision recorded" if not err else "Decision failed")


def main() -> None:
    root = tk.Tk()
    app = CockpitApp(root)
    app._sync_view("Ready")
    root.mainloop()


if __name__ == "__main__":
    main()
