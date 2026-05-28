# Research Model

## From Deductive UI To Inductive Frames

A deductive UI usually shows a target state and asks whether each rule passed. That is useful for rule compliance, but it hides the cognitive work of recognition.

This prototype treats the page as a semantic surface. The user does not start by asking whether the document is valid. The user moves through frames:

- hold the contour
- recognize candidate relations
- isolate what does not fit
- correct the surface
- attest the resulting observation

Each step records what changed and what the user was able to distinguish.

## Prepared

Prepared is what has been placed on the surface:

- the observation title and abstract
- article sections
- source candidates
- candidate confidence scores
- provenance signals
- model-recognized relations

Prepared is not acceptance. It is material made available for distinction.

## Computed

Computed is what the system can derive from Prepared:

- high-confidence candidate list
- source-to-section adjacency
- recognition summaries
- duplicate or merge suggestions
- negative fit signals

Computed can surface a candidate as relevant. It cannot decide that the candidate belongs in the final observation.

## Negative Fit

Negative fit is evidence that does not enter the bind without contradiction.

In the current scenario, candidate `c-209` appears to support the drafted claim, but a later retraction signal exists outside the indexed corpus. The model's high confidence is therefore not enough. The candidate becomes the place where the human must distinguish recognition from acceptance.

## Correction

Correction is the visible fold that changes the observation surface.

For `c-209`, correction means:

- reject the candidate as support
- keep the rejection visible
- add a footnote explaining the provenance issue
- preserve the negative candidate as part of the observation's audit trail

The correction does not erase the model's recognition. It changes how that recognition is carried.

## Attestation

Attestation is a named statement over the final surface:

- which candidates were retained
- which were merged
- which were rejected
- which correction was written
- which contour makes the observation witnessable

The system can prepare the attestation form. The system does not witness on the user's behalf.
