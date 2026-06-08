#!/usr/bin/env node
/**
 * generate_report.js — called by backend/services/report.py via subprocess
 *
 * Usage:
 *   node generate_report.js <json_input_file> <output_docx_path>
 *
 * The JSON input file must contain:
 * {
 *   "model_name":   string,
 *   "generated_at": string,          // ISO datetime
 *   "metadata": {
 *     "filename":     string,
 *     "duration_sec": number,
 *     "num_speakers": number | null
 *   },
 *   "summary":      string,
 *   "key_points":   string[],
 *   "action_items": string[],
 *   "transcript":   string | null,   // plain text (ASR mode)
 *   "segments": [                    // diarized mode (preferred)
 *     { "speaker": string, "start": number, "end": number, "text": string },
 *     ...
 *   ] | null
 * }
 */

"use strict";

// Note: Khmer OS font must be registered if using docx font embedding.
// Since docx uses the font name as a string reference (rendered by Word/LibreOffice),
// simply specifying "Khmer OS" is sufficient — Word will use the installed font.
// Ensure "Khmer OS" is installed on the machine opening the document.
// Download: https://www.khmer-unicode.org/downloads/fonts/


const fs   = require("fs");
const path = require("path");

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType,
  ShadingType, PageNumber, Footer, TabStopType, TabStopPosition,
} = require("docx");

// ── Load input ────────────────────────────────────────────────────────────────
const [,, inputFile, outputFile] = process.argv;
if (!inputFile || !outputFile) {
  console.error("Usage: node generate_report.js <input.json> <output.docx>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
const {
  model_name   = "ASR Demo",
  generated_at = new Date().toISOString(),
  metadata     = {},
  summary      = "",
  key_points   = [],
  action_items = [],
  transcript   = null,
  segments     = null,
} = data;

// ── Colours & borders ─────────────────────────────────────────────────────────
const ACCENT   = "00B374";   // green accent
const DARK     = "1A2E28";
const MUTED    = "7FA89E";
const RULE_BORDER = { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } };
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "D5E3DE" };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

// ── Speaker colours (cycling palette, hex without #) ─────────────────────────
const SPK_COLORS = ["00E5A0","00B3FF","FF7B54","A78BFA","FBBF24","F472B6","34D399","60A5FA"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTs(sec) {
  const m  = Math.floor(sec / 60);
  const s  = (sec % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

function fmtDuration(sec) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}h ${m}m ${s}s`
    : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function rule() {
  return new Paragraph({ border: RULE_BORDER, children: [] });
}

function spacer(pts = 6) {
  return new Paragraph({
    children: [],
    spacing: { before: pts * 20, after: 0 },
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: "Khmer OS", bold: true, size: 26, color: DARK })],
    spacing: { before: 320, after: 80 },
  });
}

function bulletItem(text, reference = "bullets") {
  return new Paragraph({
    numbering: { reference, level: 0 },
    children: [new TextRun({ text: text || "", font: "Khmer OS", size: 22, color: DARK })],
    spacing: { after: 60 },
  });
}

function bodyText(text) {
  return new Paragraph({
    children: [new TextRun({ text: text || "", font: "Khmer OS", size: 22, color: DARK })],
    spacing: { after: 80 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

// ── Build speaker colour map ──────────────────────────────────────────────────
const speakerColorMap = {};
let colorIdx = 0;
if (segments) {
  segments.forEach(seg => {
    if (!(seg.speaker in speakerColorMap)) {
      speakerColorMap[seg.speaker] = SPK_COLORS[colorIdx++ % SPK_COLORS.length];
    }
  });
}

// ── Metadata table ────────────────────────────────────────────────────────────
function metaTable() {
  const rows = [
    ["File",      metadata.filename     || "—"],
    ["Duration",  fmtDuration(metadata.duration_sec)],
    ["Speakers",  metadata.num_speakers != null ? String(metadata.num_speakers) : "—"],
    ["Generated", generated_at.replace("T", "  ").slice(0, 19)],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 7360],
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 2000, type: WidthType.DXA },
            shading: { fill: "E8F5F0", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, font: "Khmer OS", size: 20, color: MUTED })],
            })],
          }),
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 7360, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({ text: value, font: "Khmer OS", size: 20, color: DARK })],
            })],
          }),
        ],
      })
    ),
  });
}

// ── Transcript section ────────────────────────────────────────────────────────
function buildTranscriptSection() {
  const out = [sectionHeading("Full Transcript"), rule(), spacer(8)];

  if (segments && segments.length > 0) {
    segments.forEach(seg => {
      const color = speakerColorMap[seg.speaker] || ACCENT;
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: seg.speaker, bold: true, font: "Khmer OS", size: 20, color }),
            new TextRun({ text: `   ${fmtTs(seg.start)} → ${fmtTs(seg.end)}`,
              font: "Khmer OS", size: 18, color: MUTED }),
          ],
          spacing: { before: 180, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: seg.text || "", font: "Khmer OS", size: 22, color: DARK })],
          indent: { left: 360 },
          spacing: { after: 120 },
        })
      );
    });
  } else if (transcript) {
    transcript.split("\n").forEach(line => {
      out.push(bodyText(line || " "));
    });
  } else {
    out.push(bodyText("No transcript available."));
  }

  return out;
}

// ── Document assembly ─────────────────────────────────────────────────────────
const children = [

  // ── Cover / title ───────────────────────────────────────────────────────────
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: model_name, font: "Khmer OS", size: 48, bold: true, color: DARK })],
    spacing: { before: 0, after: 40 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Transcription Report", font: "Khmer OS", size: 28, color: MUTED })],
    spacing: { after: 320 },
  }),
  rule(),
  spacer(16),

  // ── Metadata table ───────────────────────────────────────────────────────────
  metaTable(),
  spacer(20),
  rule(),
  spacer(12),

  // ── Summary (only included when user ran summarization) ────────────────────
  ...(summary ? [
    sectionHeading("Summary"),
    rule(),
    spacer(8),
    bodyText(summary),
    spacer(8),
  ] : []),

  // ── Key Points ───────────────────────────────────────────────────────────────
  ...(key_points && key_points.length > 0 ? [
    sectionHeading("Key Points"),
    rule(),
    spacer(8),
    ...key_points.map(pt => bulletItem(pt || "", "bullets")),
    spacer(8),
  ] : []),

  // ── Action Items ─────────────────────────────────────────────────────────────
  ...(action_items && action_items.length > 0 ? [
    sectionHeading("Action Items"),
    rule(),
    spacer(8),
    ...action_items.map(ai => bulletItem(ai || "", "actions")),
    spacer(8),
  ] : []),

  // ── Full Transcript ───────────────────────────────────────────────────────────
  ...buildTranscriptSection(),
];

// ── Assemble document ─────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Khmer OS", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 48, bold: true, font: "Khmer OS", color: DARK },
        paragraph: { spacing: { before: 0, after: 40 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 26, bold: true, font: "Khmer OS", color: DARK },
        paragraph: { spacing: { before: 320, after: 80 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "actions",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "→",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size:   { width: 12240, height: 15840 },    // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: model_name, font: "Khmer OS", size: 18, color: MUTED }),
              new TextRun({ text: "\t", font: "Khmer OS", size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Khmer OS", size: 18, color: MUTED }),
              new TextRun({ text: " / ", font: "Khmer OS", size: 18, color: MUTED }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Khmer OS", size: 18, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputFile, buf);
  console.log("OK:" + outputFile);
}).catch(err => {
  console.error("ERROR:" + err.message);
  process.exit(1);
});