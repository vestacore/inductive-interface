# Semantic Inductive UI

An open research prototype for a schema-driven semantic induction interface.

The project transforms a deductive dashboard into a sequence of inductive frames. Each frame asks the user to perform one cognitive operation over a prepared semantic surface, then writes the resulting distinction, correction, or attestation to local state.

The current scenario is inspired by the article-like mockup supplied in the design brief:

> Unfold as informational overdraft.

## Research Question

Can an interface help a human witness a semantic observation without forcing them to inspect every source manually?

The prototype compresses a prepared surface of 4,210 sources into a smaller recognition surface:

- 210 candidate citations
- 18 high-confidence candidates
- 47 medium-confidence candidates
- 192 below-threshold candidates
- 1 negative-fit candidate that appears strong until provenance is inspected

The user does not review the entire corpus. The user moves through frames that make the handoff between model recognition and human fold explicit.

## Inductive Frames

The workflow has five frames:

1. `Hold contour`
   The user names the semantic contour before judging individual sources.

2. `Recognize`
   The user distinguishes claim-adjacent recognition from lexical search.

3. `Isolate negative fit`
   The user identifies evidence that does not enter the observation without contradiction.

4. `Correct fold`
   The user writes the correction that changes the observation surface.

5. `Attest`
   The user commits the observation with a visible distinction trail.

## Prepared, Computed, Attested

- `Prepared`: the drafted observation, sections, candidate source surface, and provenance signals placed before the user.
- `Computed`: model-recognized candidates, confidence scores, candidate-source relations, and negative-fit findings.
- `Attested`: human decisions, corrections, and final witnessed publication statement.

The model can recognize, rank, and expose. It cannot silently publish or accept a candidate on behalf of the witness.

## Local Run

Requirements:

- Node.js 18 or newer.
- No package install is required for this dependency-free local prototype.

Run:

```bash
node server.mjs
```

Then open:

```text
http://localhost:4173
```

In the Codex desktop runtime used to create this prototype:

```bash
/Users/leonid/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

## Project Structure

```text
public/
  index.html          Article-like inductive UI shell
  app.js              Semantic frame logic and JSON Schema form renderer
  styles.css          Editorial surface and frame styling
schemas/
  observation-contour.schema.json
  source-decision.schema.json
  semantic-correction.schema.json
  semantic-attestation.schema.json
data/
  seed/
    semantic-observation-state.json
  runtime/
    semantic-observation-state.json
    substrate-events.jsonl
docs/
  research-model.md
  nextjs-port.md
server.mjs
```

## Data Writing

The server writes local runtime state to:

```text
data/runtime/semantic-observation-state.json
data/runtime/substrate-events.jsonl
```

Each state-changing action appends an event with a previous hash and current hash. This models a simple mechanistic substrate: corrections and attestations are written as inspectable events rather than silently replacing the past.

## Prototype Status

This is a research and interaction prototype. It is designed to explore:

- semantic induction
- citation recognition
- negative fit surfacing
- human distinction over model-recognized candidates
- correction as visible fold
- attestation after provenance-aware correction
- future Next.js and JSON Forms implementation

It is not a production publishing system, citation engine, or audit-grade provenance platform.
