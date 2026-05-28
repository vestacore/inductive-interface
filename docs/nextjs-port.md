# Next.js Port Notes

This prototype is dependency-free so it can run in a restricted local workspace. The structure is designed to port to a Next.js App Router project with JSON Forms.

## Suggested Packages

```bash
npm install next react react-dom @jsonforms/core @jsonforms/react @jsonforms/vanilla-renderers ajv
```

## Suggested App Structure

```text
app/
  page.tsx
  api/
    state/route.ts
    workflow/route.ts
    decisions/route.ts
    corrections/route.ts
    attestations/route.ts
components/
  ArticleSurface.tsx
  FrameStepper.tsx
  InductiveFrame.tsx
  DistinctionLedger.tsx
  SchemaForm.tsx
lib/
  computeSemanticState.ts
  substrate.ts
schemas/
  *.schema.json
data/
  seed/
  runtime/
```

## JSON Forms Mapping

The current app uses a minimal JSON Schema form renderer. Replace it with JSON Forms in Next.js:

```tsx
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";

export function SchemaForm({ schema, data, onChange }) {
  return (
    <JsonForms
      schema={schema}
      data={data}
      renderers={vanillaRenderers}
      cells={vanillaCells}
      onChange={({ data }) => onChange(data)}
    />
  );
}
```

## Computation Boundary

Keep recognition computation pure:

```ts
computed = computeSemanticState(preparedSurface, decisions, corrections, contour)
```

The computation may invalidate a prior attestation when the surface changes. It should not replace a named witness.

## Storage Boundary

For local research, JSON files are enough. For a stronger implementation, use:

- append-only event storage
- content-addressed prepared sources
- signed attestations
- explicit user identity
- source provenance snapshots
- invalidation rules for changed prepared surfaces
