# Conditional Predicate Implications

## Introduction

There is a ground set $U$.
There is a set $Φ$ of predicates on $U$ (functions from $U$ to `bool`).
We are given a set of implications, i.e., results of the form
$a(u) ⟹ b(u) ∀ u ∈ U$, where $a, b ∈ Φ$.
We would like to infer more predicate implications using transitive closure
and then display all such predicate implications (ideally as a Hasse diagram).

This is useful to visualize, e.g., implications between fairness notions
in [fair allocation](https://en.wikipedia.org/wiki/Fair_division).
Here the ground set is the set of all allocations across all fair division instances,
and the predicates are fairness notions.

We look at a more complicated version of this problem, where the implications are conditional.
Formally, we are given a set family $Σ ⊆ 2^U$.
Each implication is of the form $a(u) ⟹ b(u) ∀ u ∈ S$, where $a, b ∈ Φ$ and $S ∈ Σ$.

This finds applications in fair allocation since many results are conditional,
i.e., envy-freeness implies proportionality only for sub-additive valuations.
We would like to infer all conditional predicates using transitive closure,
and given a set $S ∈ Σ$, display all predicate implications conditional on $S$.

## How to Run with node

For the fair allocation problem, `fairDiv/indiv-family.json` describes the family $Σ$
and `fairDiv/indiv-goods.json` describes the predicates and implications.

To return all implications for additive valuations over goods when agents have equal entitlements
(including open problems), and save the output to `goods.pdf`, run

    node scripts/cli.js --sf fairDiv/indiv-family.json -i fairDiv/indiv.json -c '{"valuation": "additive", "marginal": "nonneg", "eqEnt": true}' --maybe -o goods.pdf

To output the sequence of implications from ef (envy freeness) to ef1 for general valuations, run

    node scrpts/cli.js --sf fairDiv/indiv-family.json -i fairDiv/indiv.json -c '{}' --pred ef ef1

To be able to run this command, you must first install typescript (`npm install -g typescript`),
install the project's dependencies (`npm install`),
and then run `npx tsc` to compile the typescript code in `cpigjs`.

To run tests, run `npx mocha scripts/test.js`.
