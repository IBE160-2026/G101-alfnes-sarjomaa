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
together with the Judge's grouping of them (until it is recorded with a live key, a marked
placeholder that puts every answer in a group of its own). It is derived from this dataset and is shared under
the same licence, CC-BY-4.0, with the same credit.

## What the figure means

ProtoQA is English, and the product groups Norwegian answers. The B-cubed figure measures the
Judge on English survey answers and says nothing direct about Norwegian answers.
