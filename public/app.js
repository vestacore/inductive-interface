const stateUrl = "/api/state";
const manifestUrl = "/schemas/form-manifest.json";

let state = null;
let manifest = null;
let activeFormId = "decision";
let formSeed = {};
const schemaCache = new Map();

const $ = (selector) => document.querySelector(selector);

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function loadSchema(schemaUrl) {
  if (!schemaCache.has(schemaUrl)) {
    schemaCache.set(schemaUrl, await fetchJson(schemaUrl));
  }
  return schemaCache.get(schemaUrl);
}

function latestDecision(candidateId) {
  return [...(state.decisions || [])].reverse().find((decision) => decision.candidateId === candidateId);
}

function correctionFor(residualId) {
  return [...(state.corrections || [])].reverse().find((correction) => correction.residualId === residualId);
}

function hasAttestation() {
  return (state.attestations || []).length > 0;
}

function candidateStatus(candidate) {
  const decision = latestDecision(candidate.id);
  if (!decision) return "unreviewed";
  return decision.decisionKind;
}

function semanticDerived() {
  const decisions = state.recognitionClaims.map((candidate) => ({
    candidate,
    decision: latestDecision(candidate.id),
    status: candidateStatus(candidate)
  }));
  const retained = decisions.filter((item) => item.status === "retain").length;
  const merged = decisions.filter((item) => item.status === "merge").length;
  const rejected = decisions.filter((item) => item.status === "reject").length;
  const c209Decision = latestDecision("c-209");
  const negativeDistinguished = Boolean(c209Decision);
  const negativeCorrected = Boolean(correctionFor("negative_fit_c_209"));
  const attested = hasAttestation();
  return {
    decisions,
    retained,
    merged,
    rejected,
    negativeDistinguished,
    negativeCorrected,
    attested,
    readyToAttest: negativeCorrected && retained >= 2 && merged >= 1
  };
}

function isFrameComplete(frameId, derived) {
  if (frameId === "frame_contour") return state.workflow.currentFrameId !== "frame_contour";
  if (frameId === "frame_recognize") return derived.retained >= 2 && derived.merged >= 1;
  if (frameId === "frame_negative") return derived.negativeDistinguished;
  if (frameId === "frame_correct") return derived.negativeCorrected;
  if (frameId === "frame_attest") return derived.attested;
  return false;
}

function frameStatus(frame, derived) {
  if (frame.id === state.workflow.currentFrameId) return "active";
  return isFrameComplete(frame.id, derived) ? "complete" : "waiting";
}

function currentFrame() {
  return state.workflow.frames.find((frame) => frame.id === state.workflow.currentFrameId) || state.workflow.frames[0];
}

function frameIndex(frameId) {
  return state.workflow.frames.findIndex((frame) => frame.id === frameId);
}

async function setFrame(frameId) {
  state = await fetchJson("/api/workflow", {
    method: "POST",
    body: JSON.stringify({ currentFrameId: frameId })
  });
  await renderAll();
}

async function postDecision(payload) {
  const result = await fetchJson("/api/decisions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state = result.state;
  await renderAll();
}

async function postCorrection(payload) {
  const result = await fetchJson("/api/corrections", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state = result.state;
  await renderAll();
}

async function postAttestation(payload) {
  const result = await fetchJson("/api/attestations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state = result.state;
  await renderAll();
}

function renderHero(derived) {
  $("#observationNumber").textContent = state.observation.number;
  $("#observationTitle").textContent = state.observation.title;
  $("#byline").textContent = `${state.observation.author} / ${state.observation.date} / ${state.observation.readTime}`;
  $("#gradeLine").textContent = `${state.observation.grade} / ${state.observation.sourceCount} sources`;
  $("#publicationState").textContent = derived.attested ? "Published" : "Draft induction";
}

function renderStepper(derived) {
  $("#frameStepper").innerHTML = state.workflow.frames
    .map((frame) => {
      const status = frameStatus(frame, derived);
      return `
        <button class="step ${status}" type="button" data-frame-id="${frame.id}">
          <strong>${frame.order}. ${frame.label}</strong>
          <span>${status}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-frame-id]").forEach((button) => {
    button.addEventListener("click", () => setFrame(button.dataset.frameId));
  });
}

function renderFrameShell(derived) {
  const frame = currentFrame();
  $("#frameKicker").textContent = `Frame ${frame.order}`;
  $("#frameTitle").textContent = frame.label;
  $("#frameOperation").textContent = frame.operation;
  const status = frameStatus(frame, derived);
  $("#frameStatus").textContent = status;
  $("#frameStatus").className = `status-pill ${status === "complete" ? "complete" : status === "waiting" ? "open" : ""}`;

  const index = frameIndex(frame.id);
  $("#previousFrame").disabled = index === 0;
  $("#previousFrame").onclick = () => {
    if (index > 0) setFrame(state.workflow.frames[index - 1].id);
  };
  $("#nextFrame").textContent = index === state.workflow.frames.length - 1 ? "Stay on Attestation" : "Next Frame";
  $("#nextFrame").onclick = () => {
    const next = state.workflow.frames[Math.min(index + 1, state.workflow.frames.length - 1)];
    setFrame(next.id);
  };
}

function renderFrameContent(derived) {
  const frame = currentFrame();
  if (frame.id === "frame_contour") return renderContourFrame();
  if (frame.id === "frame_recognize") return renderRecognizeFrame(derived);
  if (frame.id === "frame_negative") return renderNegativeFrame(derived);
  if (frame.id === "frame_correct") return renderCorrectFrame(derived);
  return renderAttestFrame(derived);
}

function renderContourFrame() {
  const contour = state.observation.contour;
  $("#frameHost").innerHTML = `
    <div class="frame-grid">
      <article class="cognitive-card">
        <strong>Prepared surface</strong>
        <p>${state.preparedSurface.surfaceClaim}</p>
      </article>
      <article class="cognitive-card">
        <strong>Observation question</strong>
        <p>${contour.observationQuestion}</p>
      </article>
      <article class="cognitive-card">
        <strong>Scope held</strong>
        <p>${contour.scope}</p>
      </article>
      <article class="cognitive-card">
        <strong>Exclusion boundary</strong>
        <p>${contour.exclusionRule}</p>
      </article>
    </div>
    <button id="holdContour" class="primary-button" type="button">Hold Contour</button>
  `;
  $("#holdContour").addEventListener("click", () => setFrame("frame_recognize"));
  activeFormId = "contour";
}

function decisionButton(candidate, kind, label, rationale) {
  const active = candidateStatus(candidate) === kind ? "active" : "";
  return `<button class="candidate-action ${active}" type="button" data-candidate="${candidate.id}" data-kind="${kind}" data-rationale="${rationale}">${label}</button>`;
}

function renderRecognizeFrame(derived) {
  const cards = state.recognitionClaims
    .filter((candidate) => candidate.id !== "c-209")
    .slice(0, 5)
    .map(
      (candidate) => `
        <article class="candidate-card">
          <div class="candidate-top">
            <strong>${candidate.id} · ${candidate.label}</strong>
            <span class="confidence">${Math.round(candidate.modelConfidence * 100)}%</span>
          </div>
          <p>${candidate.whyVisible}</p>
          <p><strong>Model relation:</strong> ${candidate.modelRelation}</p>
          <div class="candidate-actions">
            ${decisionButton(candidate, "retain", "Retain", "Accepted as claim-adjacent within the selected contour.")}
            ${decisionButton(candidate, "merge", "Merge", "Merged with an existing source rather than counted as a new citation.")}
            ${decisionButton(candidate, "needs_more_prepared", "More Prepared", "The source needs more surface evidence before fold.")}
          </div>
        </article>
      `
    )
    .join("");

  $("#frameHost").innerHTML = `
    <div class="cognitive-card">
      <strong>Recognition status</strong>
      <p>The model surfaced ${state.preparedSurface.highConfidenceCount} high-confidence candidates from ${state.preparedSurface.recordCount.toLocaleString()} sources. The user distinguishes citation-worthy adjacency from lexical proximity.</p>
    </div>
    <div class="candidate-grid">${cards}</div>
  `;
  wireDecisionButtons();
  activeFormId = "decision";
}

function renderNegativeFrame(derived) {
  const candidate = state.recognitionClaims.find((item) => item.id === "c-209");
  const decision = latestDecision(candidate.id);
  $("#frameHost").innerHTML = `
    <article class="negative-card">
      <h3>${candidate.id} · ${candidate.label}</h3>
      <p><strong>Model first saw:</strong> ${candidate.modelRelation} at ${Math.round(candidate.modelConfidence * 100)}% confidence.</p>
      <p><strong>Negative signal:</strong> ${candidate.negativeSignal}</p>
      <p><strong>Current distinction:</strong> ${decision ? `${decision.decisionKind} · ${decision.rationale}` : "not yet distinguished"}</p>
      <div class="candidate-actions">
        ${decisionButton(candidate, "reject", "Reject", "Rejected because provenance contradicts the observation's exclusion rule.")}
        ${decisionButton(candidate, "needs_more_prepared", "More Prepared", "Held open because the retraction signal needs a stronger prepared source.")}
      </div>
    </article>
    <div class="cognitive-card">
      <strong>What changed</strong>
      <p>${derived.negativeDistinguished ? "The user has separated model recognition from author acceptance." : "The negative fit is visible, but no human distinction has been written."}</p>
    </div>
  `;
  wireDecisionButtons();
  activeFormId = "decision";
  formSeed = {
    candidateId: "c-209",
    decisionKind: "reject",
    rationale: "Rejected because provenance contradicts the observation's exclusion rule.",
    distinguishedBy: "negative provenance signal",
    decidedBy: "author"
  };
}

function renderCorrectFrame(derived) {
  const correction = correctionFor("negative_fit_c_209");
  $("#frameHost").innerHTML = `
    <div class="frame-grid">
      <article class="cognitive-card">
        <strong>Correction target</strong>
        <p>Section IV receives the rejected candidate as a visible case study rather than hidden failed recognition.</p>
      </article>
      <article class="cognitive-card">
        <strong>Correction status</strong>
        <p>${correction ? correction.statement : "No correction has been written to the substrate yet."}</p>
      </article>
    </div>
    <button id="writeCorrection" class="primary-button" type="button">${correction ? "Correction Written" : "Write Correction"}</button>
  `;
  $("#writeCorrection").disabled = Boolean(correction);
  $("#writeCorrection").addEventListener("click", () =>
    postCorrection({
      residualId: "negative_fit_c_209",
      mode: "add_footnote",
      candidateId: "c-209",
      targetSectionId: "section_rejected",
      statement: "Rejected [c-209] (Pavlov, 2024 preprint) because the author later retracted the claim; retraction not yet indexed.",
      surfaceChange: "Add decided-by-author footnote and keep the rejected candidate visible as negative evidence.",
      createdBy: "author"
    })
  );
  activeFormId = "correction";
  formSeed = {
    residualId: "negative_fit_c_209",
    mode: "add_footnote",
    candidateId: "c-209",
    targetSectionId: "section_rejected",
    statement: "Rejected [c-209] (Pavlov, 2024 preprint) because the author later retracted the claim; retraction not yet indexed.",
    surfaceChange: "Add decided-by-author footnote and keep the rejected candidate visible as negative evidence.",
    createdBy: "author"
  };
}

function renderAttestFrame(derived) {
  const attestations = state.attestations || [];
  const attestation = attestations[attestations.length - 1];
  $("#frameHost").innerHTML = `
    <div class="formation-grid">
      <article class="formation-card">
        <strong>Retained</strong>
        <p>${derived.retained} claim-adjacent sources.</p>
      </article>
      <article class="formation-card">
        <strong>Merged</strong>
        <p>${derived.merged} overlapping source.</p>
      </article>
      <article class="formation-card">
        <strong>Rejected</strong>
        <p>${derived.rejected} candidate preserved as negative evidence.</p>
      </article>
      <article class="formation-card">
        <strong>Correction</strong>
        <p>${derived.negativeCorrected ? "Footnote correction has been written." : "Correction is still missing."}</p>
      </article>
    </div>
    <button id="writeAttestation" class="primary-button" type="button">${attestation ? "Attestation Written" : "Publish Observation Fold"}</button>
    ${attestation ? `<div class="cognitive-card"><strong>Witnessed statement</strong><p>${attestation.statement}</p></div>` : ""}
  `;
  $("#writeAttestation").disabled = Boolean(attestation) || !derived.readyToAttest;
  $("#writeAttestation").addEventListener("click", () =>
    postAttestation({
      attestationKind: "publish_observation",
      statement: "I witness this observation as citation-grade within the stated contour: retained and merged sources are claim-adjacent, and c-209 is rejected with a visible provenance correction.",
      witnessId: state.observation.contour.witness,
      basisPreparedIds: "prepared_surface_4210_sources",
      basisComputedIds: state.computedFindings.map((finding) => finding.id).join(","),
      basisDecisionIds: (state.decisions || []).map((decision) => decision.id).join(",")
    })
  );
  activeFormId = "attestation";
}

function wireDecisionButtons() {
  document.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = state.recognitionClaims.find((item) => item.id === button.dataset.candidate);
      postDecision({
        candidateId: candidate.id,
        decisionKind: button.dataset.kind,
        rationale: button.dataset.rationale,
        distinguishedBy: candidate.negativeSignal ? "negative provenance signal" : "claim adjacency",
        decidedBy: "author"
      });
    });
  });
}

function renderArticleSurface(derived) {
  const recognized = state.computedFindings.find((finding) => finding.id === "model_recognition_summary");
  const correction = correctionFor("negative_fit_c_209");
  const firstSections = state.observation.sections.slice(0, 3);
  const extraSection = state.observation.sections.find((section) => section.id === "section_rejected");
  $("#articleSurface").innerHTML = `
    <section class="abstract">
      <p class="eyebrow">Abstract</p>
      <p>${state.observation.abstract}</p>
    </section>
    ${firstSections
      .map(
        (section, index) => `
          <section class="article-section" id="${section.id}">
            <p class="section-kicker">Section ${index + 1}</p>
            <h2>${section.title}</h2>
            <p>${section.body}</p>
            ${
              index === 0
                ? `<div class="callout"><strong>Recognised by model</strong><p>${recognized.statement}</p></div>`
                : ""
            }
          </section>
        `
      )
      .join("")}
    <section class="article-section" id="${extraSection.id}">
      <p class="section-kicker">Section IV</p>
      <h2>${extraSection.title}</h2>
      <p>${extraSection.body}</p>
      <div class="callout red">
        <strong>Decided by author</strong>
        <p>${correction ? correction.statement : "Rejected candidate c-209 is visible, but the correction has not yet been written."}</p>
      </div>
    </section>
  `;
}

function renderRail(derived) {
  const trail = [
    ["Surface", `${state.preparedSurface.recordCount.toLocaleString()} sources prepared`],
    ["Recognized", `${state.preparedSurface.highConfidenceCount} high-confidence candidates surfaced`],
    ["Distinguished", `${derived.retained} retained / ${derived.merged} merged / ${derived.rejected} rejected`],
    ["Negative fit", derived.negativeDistinguished ? "c-209 distinguished" : "c-209 still open"],
    ["Correction", derived.negativeCorrected ? "footnote written" : "correction pending"],
    ["Attestation", derived.attested ? "published fold" : "not attested"]
  ];
  $("#distinctionTrail").innerHTML = trail
    .map(
      ([label, value]) => `
        <div class="trail-item">
          <strong>${label}</strong>
          <span>${value}</span>
        </div>
      `
    )
    .join("");

  $("#sectionsList").innerHTML = state.observation.sections
    .map((section) => `<li><strong>${section.roman}</strong> ${section.title}</li>`)
    .join("");

  $("#citationRail").innerHTML = state.recognitionClaims
    .slice(0, 4)
    .map((candidate) => {
      const status = candidateStatus(candidate);
      return `
        <div class="citation-item">
          <strong>[${candidate.id}] ${candidate.label}</strong>
          <span>${candidate.source} / ${status}</span>
        </div>
      `;
    })
    .join("");
}

async function renderEvents() {
  const events = await fetchJson("/api/events");
  $("#eventsLog").innerHTML = events.length
    ? events
        .slice(-5)
        .reverse()
        .map(
          (event) => `
            <div class="event-item">
              <strong>${event.type}</strong>
              <span>${event.hash.slice(0, 18)}...</span>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No substrate events yet.</div>`;
}

function createField(name, property, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.textContent = property.title || name;
  label.htmlFor = `field_${name}`;
  wrapper.append(label);

  let input;
  if (property.enum) {
    input = document.createElement("select");
    for (const option of property.enum) {
      const item = document.createElement("option");
      item.value = option;
      item.textContent = option;
      input.append(item);
    }
  } else if (name.toLowerCase().includes("statement") || name.toLowerCase().includes("rationale") || name.toLowerCase().includes("scope") || name.toLowerCase().includes("rule") || name.toLowerCase().includes("change")) {
    input = document.createElement("textarea");
  } else {
    input = document.createElement("input");
    input.type = property.format === "date" ? "date" : property.type === "number" ? "number" : "text";
  }
  input.id = `field_${name}`;
  input.name = name;
  if (value !== undefined && value !== null) input.value = value;
  wrapper.append(input);

  if (property.description) {
    const help = document.createElement("small");
    help.textContent = property.description;
    wrapper.append(help);
  }
  return wrapper;
}

function castValue(property, value) {
  if (property.type === "number") return Number(value || 0);
  if (property.type === "boolean") return value === "true";
  return value;
}

function initialFormData() {
  if (activeFormId === "contour") return state.observation.contour;
  if (activeFormId === "decision") {
    return Object.keys(formSeed).length
      ? formSeed
      : {
          candidateId: "c-101",
          decisionKind: "retain",
          rationale: "Accepted as claim-adjacent within the selected contour.",
          distinguishedBy: "claim adjacency",
          decidedBy: "author"
        };
  }
  if (activeFormId === "correction") {
    return Object.keys(formSeed).length
      ? formSeed
      : {
          residualId: "negative_fit_c_209",
          mode: "add_footnote",
          candidateId: "c-209",
          targetSectionId: "section_rejected",
          statement: "Rejected c-209 because provenance contradicts the exclusion rule.",
          surfaceChange: "Add footnote and keep rejected candidate visible.",
          createdBy: "author"
        };
  }
  return {
    attestationKind: "publish_observation",
    statement: "I witness this observation as citation-grade within the stated contour.",
    witnessId: state.observation.contour.witness,
    basisPreparedIds: "prepared_surface_4210_sources",
    basisComputedIds: state.computedFindings.map((finding) => finding.id).join(","),
    basisDecisionIds: (state.decisions || []).map((decision) => decision.id).join(",")
  };
}

async function renderForms() {
  if (!manifest) return;
  $("#formTabs").innerHTML = manifest.forms
    .map(
      (form) => `
        <button class="form-tab ${form.id === activeFormId ? "active" : ""}" type="button" data-form-id="${form.id}">
          ${form.label}
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-form-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFormId = button.dataset.formId;
      formSeed = {};
      renderForms();
    });
  });

  const formConfig = manifest.forms.find((form) => form.id === activeFormId);
  const schema = await loadSchema(formConfig.schema);
  const initial = initialFormData();
  const form = document.createElement("form");
  form.className = "json-form";

  for (const [name, property] of Object.entries(schema.properties)) {
    form.append(createField(name, property, initial[name]));
  }

  const submit = document.createElement("button");
  submit.className = "primary-button";
  submit.type = "submit";
  submit.textContent = "Write";
  form.append(submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = {};
    const formData = new FormData(form);
    for (const [name, property] of Object.entries(schema.properties)) {
      data[name] = castValue(property, formData.get(name));
    }
    const result = await fetchJson(formConfig.endpoint, {
      method: "POST",
      body: JSON.stringify(data)
    });
    state = result.state || result;
    formSeed = {};
    await renderAll();
  });

  $("#formHost").replaceChildren(form);
}

async function renderAll() {
  const derived = semanticDerived();
  renderHero(derived);
  renderStepper(derived);
  renderFrameShell(derived);
  renderFrameContent(derived);
  renderArticleSurface(derived);
  renderRail(derived);
  await renderEvents();
  await renderForms();
}

async function boot() {
  [state, manifest] = await Promise.all([fetchJson(stateUrl), fetchJson(manifestUrl)]);
  $("#reloadButton").addEventListener("click", async () => {
    state = await fetchJson(stateUrl);
    await renderAll();
  });
  $("#resetButton").addEventListener("click", async () => {
    state = await fetchJson("/api/state/reset", { method: "POST", body: "{}" });
    activeFormId = "decision";
    formSeed = {};
    await renderAll();
  });
  $("#backButton").addEventListener("click", () => setFrame("frame_contour"));
  $("#assistantButton").addEventListener("click", () => setFrame("frame_attest"));
  await renderAll();
}

boot().catch((error) => {
  document.body.innerHTML = `<pre>${error.stack || error.message}</pre>`;
});
