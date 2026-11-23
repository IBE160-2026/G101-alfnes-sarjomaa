# ProtoQA attribution

`dev.crowdsourced.jsonl` is part of the ProtoQA dataset by the ProtoQA authors,
Information Extraction and Synthesis Laboratory (IESL), UMass Amherst, published with the paper
"ProtoQA: A Question Answering Dataset for Prototypical Common-Sense Reasoning"
(EMNLP 2020, <https://arxiv.org/abs/2005.00771>).

- **Source:** <https://github.com/iesl/protoqa-data>, commit
  `c6c5696cd0cc18d990499a431c2923cef8003104`, file `data/dev/dev.crowdsourced.jsonl`.
- **SHA-256:** `cd3bec04e9ec9294ebf5b75eda6eb0d5abcffec926407eaf852be9c744c67ce5`.
- **Licence:** Creative Commons Attribution 4.0 International (CC-BY-4.0),
  <https://creativecommons.org/licenses/by/4.0/>, as stated in the repository's `LICENSE`.
- **No changes to the file.** It is a verbatim copy. It has 52 rows, although the dataset's
  README says 51.

Only this crowdsourced dev file is in the repository. No scraped, training or test file is
committed.

## Changes made by the evaluation

`npm run judge:eval` (`src/cli/judge-eval.ts`) reads the file as it is and changes the data in
memory only:

- Every raw answer is normalised with the app's own rule (`src/lib/normalize.ts`: Unicode NFC,
  lower case, trimmed, inner whitespace collapsed, trailing punctuation removed), and answers
  that become the same text are one item.
- Raw answers that the annotators left out of every cluster (285 raw strings, 305 of the 5,192
  respondent answers, such as "na" and "answer") have no gold label. They are dropped before
  the Judge sees the question.
- Each item's weight is the number of respondents behind it, and its gold cluster is the
  cluster holding most of that weight.

## Derived file

`data/rulings/protoqa-dev.json` holds the ProtoQA questions and their normalised answers
together with the Judge's grouping of them, recorded live on 2026-11-23. A question where the
Judge's output was invalid is stored with every answer in a group of its own, as the app would
show it, and its `model` says `fallback`. It is derived from this dataset and is shared under
the same licence, CC-BY-4.0, with the same credit.

## What the figure means

ProtoQA is English, and the product groups Norwegian answers. The B-cubed figure measures the
Judge on English survey answers and says nothing direct about Norwegian answers.

## Derived Question sets (Stage 2, FR-33)

`data/question-sets/protoqa-nb.json` holds five Question sets of five Questions each, 25 Questions
in all, taken from `dev.crowdsourced.jsonl` above. It is a derived work of the ProtoQA dataset by
the ProtoQA authors (IESL, UMass Amherst), shared under the same licence, CC-BY-4.0
(<https://creativecommons.org/licenses/by/4.0/>), with the same credit.

**The material is translated and adapted.** The changes are:

- **Selection.** Only 25 of the 52 Questions are used. Questions that make little sense at a
  Norwegian party, or that are crude, were left out.
- **Translation.** Each Question was translated into Norwegian (bokmål) by hand. Every Question
  keeps its source id (`sourceId`, the row's `metadata.id`).
- **Group labels.** The dataset's clusters have no label, only their raw answers. Each label is a
  short Norwegian name written by hand for what the cluster's answers have in common. Every Group
  keeps its source cluster id (`cluster`).
- **Board size.** Only the top clusters by count are kept, at most eight per Question, as on the
  app's Board (FR-21). None of the 25 Questions has a tie at the eighth place. The app orders
  the slots itself, by Count and then by the Norwegian label, so the order in the file is not
  the slot order.

**Counts are unchanged.** Every `count` is the cluster's count in the source file.

The app credits the source on the play screen of every Game made from a set, and in the README.
The play screen carries the short form "Spørsmål fra ProtoQA (CC BY 4.0), oversatt og tilpasset".
The full credit, with the ProtoQA authors, is in this file and in the README.
No model or API was used for the translation.
