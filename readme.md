# cpigjs

This project contains `cpigjs`, a program written in JavaScript
to draw Conditional Predicate Implication Graphs.

The primary application of `cpigjs` is visualizing implications among fairness notions
for the problem of [fairly allocating indivisible items](https://en.wikipedia.org/wiki/Fair_item_allocation).
The `fairDiv` directory contains data on implications, which `cpigjs` can use to
infer additional implications and draw them as a DAG.

## Introduction

There is a set $Φ$ of predicates on a ground set $Ω$
(i.e., functions from $Ω$ to `bool`).
We say that a predicate $a ∈ Φ$ implies another predicate $b ∈ Φ$
conditioned on set $S ⊆ Ω$ if $a(u) ⟹ b(u) ∀ u ∈ S$.

Given a set of conditional implications,
`cpigjs` infers more of them using transitive closure
and then displays them as a Hasse diagram.

This is useful to visualize, e.g., implications between fairness notions in the fair division problem.
Here the ground set is the set of all allocations across all fair division instances,
and the predicates are fairness notions.
Implications are often conditional on, e.g., valuation functions being additive,
or the items being goods.

The ground set is generally uncountably large (e.g., in fair division),
so we cannot explicitly enumerate its members.
Instead, we implicitly define a set family $Σ$ over $Ω$
(i.e., $Σ$ is a subset of the power set of $Ω$),
and every implication is conditioned on a set from $Σ$.

For the problem of fairly allocating indivisible items,
`fairDiv/setFamily.json` describes the family $Σ$
and `fairDiv/data.json` describes the predicates and implications.

## How to Run with node

Install [Graphviz](https://graphviz.org/documentation/) and ensure that the
`dot` command is available on your command line.
Install the project's npm dependencies: `npm install`.

To return all implications for additive valuations over goods when agents have equal entitlements
(including open problems), and save the output to `goods.pdf`, run

    node scripts/cli.js --sf fairDiv/setFamily.json -i fairDiv/data.json -c '{"valuation": "additive", "marginal": "nonneg", "eqEnt": true}' --maybe -o goods.pdf

To output the sequence of implications from EF (envy freeness) to EF1 for general valuations, run

    node scripts/cli.js --sf fairDiv/setFamily.json -i fairDiv/data.json -c '{}' --pred EF EF1

## How to Run in the Browser

Serve this project's root directory (i.e., `fairDiv`'s parent directory) using an HTTP server,
and open `fairDiv/index.html` in your web browser.
