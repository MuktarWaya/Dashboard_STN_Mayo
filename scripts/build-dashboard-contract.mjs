import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const dataPath = process.argv[2];
const outputDir = process.argv[3];

if (!dataPath || !outputDir) {
  throw new Error("Usage: node build-dashboard-contract.mjs <contract-data.json> <output-dir>");
}

const raw = JSON.parse(await fs.readFile(dataPath, "utf8"));
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();

const colors = {
  navy: "#1F4E79",
  blue: "#D9EAF7",
  teal: "#0F766E",
  green: "#E2F0D9",
  yellow: "#FFF2CC",
  orange: "#FCE4D6",
  red: "#F4CCCC",
  gray: "#F3F4F6",
  border: "#D9E2EC",
  white: "#FFFFFF",
};

const thaiLabels = {
  year: "ปีงบประมาณ",
  month: "เดือน",
  facility_id: "รหัสและชื่อหน่วยบริการ",
  facility_code: "รหัสหน่วยบริการ",
  facility_name: "ชื่อหน่วยบริการ",
  note: "หมายเหตุ",
  monthly_result_note: "ผลการดำเนินงานรายเดือน/หมายเหตุ",
  dm_screen_target: "จำนวนประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบทั้งหมด (DM)",
  dm_screen_percent: "ผลงานคัดกรองเบาหวาน (ร้อยละ)",
  dm_suspected: "จำนวนกลุ่มสงสัยป่วยโรคเบาหวาน",
  dm_confirm_percent: "ผลงานติดตามยืนยันเบาหวาน (ร้อยละ)",
  dm_patient_total: "จำนวนผู้ป่วยเบาหวานในเขตรับผิดชอบ",
  hba1c_percent: "ผู้ป่วยเบาหวานได้รับ HbA1c อย่างน้อย 1 ครั้ง/ปี (ร้อยละ)",
  ht_screen_target: "จำนวนประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบทั้งหมด (HT)",
  ht_screen_percent: "ผลงานคัดกรองความดันโลหิตสูง (ร้อยละ)",
  ht_suspected: "จำนวนกลุ่มสงสัยป่วยโรคความดันโลหิตสูงทั้งหมด",
  ht_confirm_percent: "ผลงานติดตามยืนยันความดันโลหิตสูง (ร้อยละ)",
  dm_ht_patient_total: "จำนวนผู้ป่วย DM และ/หรือ HT ในเขตรับผิดชอบ",
  ckd_screen_percent: "ผู้ป่วย DM/HT ได้รับคัดกรองโรคไตเรื้อรัง (ร้อยละ)",
  pregnant_new: "จำนวนมารดาตั้งครรภ์รายใหม่",
  delivered_total: "จำนวนมารดาที่คลอด",
  anc_before_12w: "ฝากครรภ์ครั้งแรกก่อน 12 สัปดาห์",
  anc_5_quality: "ฝากครรภ์ครบ 5 ครั้งตามเกณฑ์",
  postpartum_visit_1_7d: "เยี่ยมหลังคลอดครั้งที่ 1 (1-7 วัน)",
  postpartum_visit_8_14d: "เยี่ยมหลังคลอดครั้งที่ 2 (8-14 วัน)",
  postpartum_visit_15_42d: "เยี่ยมหลังคลอดครั้งที่ 3 (15-42 วัน)",
  breastfeeding_6m: "เลี้ยงลูกด้วยนมแม่ 6 เดือนขึ้นไป",
  pending: "คงค้าง",
  fully1_target: "เป้าหมาย Fully 1 ปี",
  fully1_done: "ผลงาน Fully 1 ปี",
  fully1_percent: "ร้อยละ Fully 1 ปี",
  fully1_gap: "ส่วนขาด Fully 1 ปี",
  fully2_target: "เป้าหมาย Fully 2 ปี",
  fully2_done: "ผลงาน Fully 2 ปี",
  fully2_percent: "ร้อยละ Fully 2 ปี",
  fully2_gap: "ส่วนขาด Fully 2 ปี",
  fully3_target: "เป้าหมาย Fully 3 ปี",
  fully3_done: "ผลงาน Fully 3 ปี",
  fully3_percent: "ร้อยละ Fully 3 ปี",
  fully3_gap: "ส่วนขาด Fully 3 ปี",
  fully5_target: "เป้าหมาย Fully 5 ปี",
  fully5_done: "ผลงาน Fully 5 ปี",
  fully5_percent: "ร้อยละ Fully 5 ปี",
  fully5_gap: "ส่วนขาด Fully 5 ปี",
  target_9_72m: "เป้าหมายเด็ก 9-72 เดือน",
  screened: "คัดกรองพัฒนาการ",
  normal: "สมวัย",
  suspected_delay: "สงสัยล่าช้า",
  followup_1m: "ติดตาม 1 เดือน",
  referred_diagnosis: "ส่งต่อเพื่อวินิจฉัย",
  population_total: "จำนวนประชากรในเขตรับผิดชอบทั้งหมด",
  dental_access_percent: "ประชากรเข้าถึงบริการทันตกรรมรวมทุกสิทธิ (ร้อยละ)",
  pregnant_total: "จำนวนหญิงตั้งครรภ์ทั้งหมด",
  pregnant_oral_percent: "หญิงตั้งครรภ์ได้รับตรวจ/ทำความสะอาดช่องปาก (ร้อยละ)",
  child_0_2_total: "จำนวนเด็ก 0-2 ปีทั้งหมด",
  child_0_2_oral_percent: "เด็ก 0-2 ปีได้รับตรวจช่องปาก (ร้อยละ)",
  child_0_2_fluoride_total: "จำนวนเด็ก 0-2 ปีทั้งหมด (ฟลูออไรด์)",
  child_0_2_fluoride_percent: "เด็ก 0-2 ปีได้รับทาฟลูออไรด์ (ร้อยละ)",
  child_3_5_total: "จำนวนเด็ก 3-5 ปีทั้งหมด",
  child_3_5_oral_percent: "เด็ก 3-5 ปีได้รับตรวจช่องปาก (ร้อยละ)",
  child_3_5_fluoride_total: "จำนวนเด็ก 3-5 ปีทั้งหมด (ฟลูออไรด์)",
  child_3_5_fluoride_percent: "เด็ก 3-5 ปีได้รับทาฟลูออไรด์ (ร้อยละ)",
  child_6_12_total: "จำนวนเด็ก 6-12 ปีทั้งหมด",
  child_6_12_oral_percent: "เด็ก 6-12 ปีได้รับตรวจช่องปาก (ร้อยละ)",
  child_6_total: "จำนวนเด็กอายุ 6 ปีทั้งหมด",
  child_6_sealant_percent: "เด็กอายุ 6 ปีได้รับเคลือบหลุมร่องฟันกรามแท้ (ร้อยละ)",
  child_0_5_total: "จำนวนเด็ก 0-5 ปีทั้งหมด",
  cavity_free_percent: "เด็ก 0-5 ปีฟันดีไม่มีผุ (ร้อยละ)",
  outreach_total: "จำนวนผู้ได้รับบริการทันตสาธารณสุขเชิงรุก",
  outreach_percent: "ผลงานทันตสาธารณสุขเชิงรุก (ร้อยละ)",
  dental_service_total: "รับบริการทันตกรรมรวม",
  pending_percent: "รอดำเนินการ (ร้อยละ)",
  elderly_target: "เป้าหมายผู้สูงอายุ",
  elderly_total: "จำนวนประชากรผู้สูงอายุ",
  screening9_percent: "ผู้สูงอายุได้รับคัดกรอง 9 ด้าน (ร้อยละ)",
  wnp_risk_total: "จำนวนกลุ่มเสี่ยงอย่างน้อย 1 ด้าน",
  wnp_percent: "จัดทำ WNP ในกลุ่มเสี่ยง (ร้อยละ)",
  careplan_dependent_total: "จำนวนผู้มีภาวะพึ่งพิงที่ต้องจัดทำ Care plan",
  careplan_percent: "จัดทำ Care plan ในกลุ่มภาวะพึ่งพิง (ร้อยละ)",
  club_assessment_percent: "ผลการประเมินชมรมผู้สูงอายุ (ร้อยละ)",
  club_result_percent: "ผลงานชมรมผู้สูงอายุ (ร้อยละ)",
  women_30_60_target: "เป้าหมายสตรีอายุ 30-60 ปี",
  hpv_kits_distributed: "แจกชุดตรวจ HPV",
  hpv_kits_returned: "ส่งคืนชุดตรวจ HPV",
  hpv_normal: "ผล HPV ปกติ",
  hpv_abnormal: "ผล HPV ผิดปกติ",
  repeat_appointment: "นัดตรวจซ้ำ",
  ca_cx_diagnosed: "วินิจฉัย CA Cx",
  cbe_breast_screened: "ตรวจมะเร็งเต้านม CBE",
};

function addSheet(name) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  return sheet;
}

function writeMatrix(sheet, startCell, rows) {
  if (!rows.length) return;
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const out = [...row];
    while (out.length < width) out.push("");
    return out;
  });
  sheet.getRange(startCell).writeValues(padded);
}

function styleTable(sheet, startRow, startCol, rowCount, colCount, inputCols = []) {
  if (rowCount <= 0 || colCount <= 0) return;
  const range = sheet.getRangeByIndexes(startRow, startCol, rowCount, colCount);
  range.format = {
    font: { name: "Aptos", size: 10 },
    borders: { preset: "all", style: "thin", color: colors.border },
  };
  const header = sheet.getRangeByIndexes(startRow, startCol, 1, colCount);
  header.format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, name: "Aptos", size: 10 },
    wrapText: true,
    verticalAlignment: "middle",
  };
  if (rowCount > 1 && inputCols.length) {
    inputCols.forEach((colIndex) => {
      sheet.getRangeByIndexes(startRow + 1, startCol + colIndex, rowCount - 1, 1).format = {
        fill: colors.yellow,
      };
    });
  }
  sheet.freezePanes.freezeRows(startRow + 1);
  range.format.autofitColumns();
  range.format.autofitRows();
}

function setWidths(sheet, widths) {
  widths.forEach((width, i) => {
    sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidthPx = width;
  });
}

function safeValue(v) {
  if (v === null || v === undefined) return "";
  return v;
}

const readme = addSheet("README");
writeMatrix(readme, "A1", [
  ["DashboardSTN Backend Data Contract"],
  ["วัตถุประสงค์", "ไฟล์นี้คือโครงชีตกลางสำหรับให้เจ้าของงาน 7 งานกรอกข้อมูล และให้ Apps Script อ่านไปสร้าง JSON สำหรับหน้า Dashboard"],
  ["หลักการสำคัญ", "1 row = 1 หน่วยบริการ + 1 เดือน + 1 งาน, ใช้รหัสหน่วยบริการจาก facility_code, กรอกเฉพาะข้อมูลสรุป ไม่มีข้อมูลผู้ป่วยรายบุคคล"],
  ["ชีตที่เจ้าหน้าที่กรอก", "Data_NCD, Data_MCH, Data_Vaccine, Data_ECD, Data_Dental, Data_Elderly, Data_Cancer"],
  ["หัวตาราง 2 ภาษา", "แถวที่ 1 เป็นภาษาไทยสำหรับคนกรอก แถวที่ 2 เป็น backend key ภาษาอังกฤษสำหรับระบบ ห้ามลบหรือเปลี่ยนแถวที่ 2"],
  ["ชีตอ้างอิง", "Facilities, ProgramOwners, MetricCatalog, DataContract, BackendMapping"],
  ["สีเหลือง", "คอลัมน์ที่เจ้าหน้าที่กรอก/แก้ไขได้"],
  ["สีกรมท่า", "หัวตาราง/คอลัมน์ที่ระบบใช้ ห้ามเปลี่ยนชื่อคอลัมน์"],
  ["การนำไปใช้", "นำชีตเหล่านี้เข้า Google Sheets เดียวกับ Apps Script แล้วรัน setupDataContractSheets() หรือคัดลอกหัวตารางตามไฟล์นี้"],
]);
readme.getRange("A1:B1").merge();
readme.getRange("A1").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 16, name: "Aptos" },
};
readme.getRange("A2:B9").format = {
  borders: { preset: "all", style: "thin", color: colors.border },
  wrapText: true,
};
readme.getRange("A2:A9").format = { fill: colors.blue, font: { bold: true } };
setWidths(readme, [210, 760]);

const facilities = addSheet("Facilities");
const facilityRows = [
  ["facility_code", "facility_id", "facility_name", "subdistrict", "active"],
  ...raw.facilities.map((f) => [f.facility_code, f.facility_id, f.facility_name, f.subdistrict, f.active]),
];
writeMatrix(facilities, "A1", facilityRows);
styleTable(facilities, 0, 0, facilityRows.length, facilityRows[0].length, [3, 4]);
setWidths(facilities, [120, 330, 330, 180, 100]);

const owners = addSheet("ProgramOwners");
const ownerRows = [
  ["program_id", "program_name", "program_short", "icon", "owner_name", "phone", "update_frequency", "source_sheet"],
  ...raw.programs.map((p) => [p.program_id, p.program_name, p.program_short, p.icon, "(รอระบุ)", "", p.update_frequency, p.sheet_name]),
];
writeMatrix(owners, "A1", ownerRows);
styleTable(owners, 0, 0, ownerRows.length, ownerRows[0].length, [4, 5, 6]);
setWidths(owners, [110, 280, 110, 70, 220, 140, 140, 160]);

const metrics = addSheet("MetricCatalog");
const metricRows = [
  ["program_id", "metric_key", "metric_label", "value_type", "denominator_key", "source_column", "source_sheet", "dashboard_role", "target_percent"],
  ...raw.metrics.map((m) => [
    m.program_id,
    m.metric_key,
    m.metric_label,
    m.value_type,
    m.denominator_key,
    m.source_column,
    m.source_sheet,
    m.dashboard_role,
    80,
  ]),
];
writeMatrix(metrics, "A1", metricRows);
styleTable(metrics, 0, 0, metricRows.length, metricRows[0].length, [8]);
setWidths(metrics, [100, 170, 390, 100, 160, 170, 150, 130, 120]);

const contract = addSheet("DataContract");
const contractRows = [["sheet_name", "program_id", "column_name", "data_type", "required", "editable", "description"]];
Object.entries(raw.sheets).forEach(([sheetName, info]) => {
  info.schema.forEach((col) => {
    let type = "number";
    if (["facility_id", "facility_code", "facility_name", "note", "monthly_result_note"].includes(col)) type = "text";
    if (["year", "month"].includes(col)) type = "integer";
    contractRows.push([
      sheetName,
      info.program_id,
      col,
      type,
      ["year", "month", "facility_id", "facility_code", "facility_name"].includes(col) ? "yes" : "no",
      ["year", "month", "facility_id", "facility_code", "facility_name"].includes(col) ? "no" : "yes",
      "",
    ]);
  });
});
writeMatrix(contract, "A1", contractRows);
styleTable(contract, 0, 0, contractRows.length, contractRows[0].length, [6]);
setWidths(contract, [150, 110, 260, 110, 90, 90, 420]);

const mapping = addSheet("BackendMapping");
const mappingRows = [
  ["dashboard_json_path", "source_sheet", "source_column_or_rule", "note"],
  ["facilities[]", "Facilities", "facility_code, facility_id, facility_name, active", "ใช้แสดงรายชื่อ รพ.สต. จริง"],
  ["programs[].metrics", "MetricCatalog + Data_*", "aggregateByMetricCatalog()", "รวมยอดระดับอำเภอจากชีตรายหน่วย"],
  ["programs[].progressPercent", "MetricCatalog", "primary metrics average", "ถ้า value_type=percent ใช้ค่าเฉลี่ยถ่วงตาม denominator; ถ้า count ใช้ sum(done)/sum(target)"],
  ["facilityProgress[]", "Data_Vaccine + Data_Cancer", "vaccine fully1 + cancer HPV returned/distributed", "ใช้ในตารางรายหน่วยบริการเดิมของหน้า Dashboard"],
  ["monthlyProgress.vaccine", "Data_Vaccine", "fully1/fully2/fully3/fully5 by month", "ช่วงแรกใช้เดือนที่มีในชีต"],
  ["cancerTracking", "Data_Cancer", "women_30_60_target, hpv_*", "ใช้ section งานมะเร็งแบบละเอียด"],
];
writeMatrix(mapping, "A1", mappingRows);
styleTable(mapping, 0, 0, mappingRows.length, mappingRows[0].length, [3]);
setWidths(mapping, [230, 220, 300, 520]);

Object.entries(raw.sheets).forEach(([sheetName, info]) => {
  const sheet = addSheet(sheetName);
  const labelRow = info.schema.map((col) => thaiLabels[col] || col);
  const rows = [
    labelRow,
    info.schema,
    ...info.rows.map((row) => info.schema.map((col) => safeValue(row[col]))),
  ];
  writeMatrix(sheet, "A1", rows);
  const inputCols = info.schema
    .map((col, i) => (["year", "month", "facility_id", "facility_code", "facility_name"].includes(col) ? -1 : i))
    .filter((i) => i >= 0);
  styleTable(sheet, 0, 0, rows.length, rows[0].length, inputCols);
  sheet.getRangeByIndexes(0, 0, 1, rows[0].length).format = {
    fill: colors.teal,
    font: { bold: true, color: colors.white, name: "Aptos", size: 10 },
    wrapText: true,
    verticalAlignment: "middle",
  };
  sheet.getRangeByIndexes(1, 0, 1, rows[0].length).format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, name: "Aptos", size: 9 },
    wrapText: true,
    verticalAlignment: "middle",
  };
  sheet.freezePanes.freezeRows(2);
  const widths = info.schema.map((col) => {
    if (col === "facility_id") return 330;
    if (col === "facility_name") return 320;
    if (col === "note" || col === "monthly_result_note") return 220;
    if (col.includes("percent")) return 120;
    return 130;
  });
  setWidths(sheet, widths);
});

const summary = addSheet("QA_Checks");
const qaRows = [
  ["check_name", "formula_or_value", "expected"],
  ["facility_count", raw.facilities.length, 13],
  ["program_count", raw.programs.length, 7],
  ["data_sheet_count", Object.keys(raw.sheets).length, 7],
  ["source_file", raw.source, ""],
  ["note", "ตรวจสอบว่าชื่อคอลัมน์ใน DataContract ตรงกับ Apps Script ก่อน deploy", ""],
];
writeMatrix(summary, "A1", qaRows);
styleTable(summary, 0, 0, qaRows.length, qaRows[0].length, []);
setWidths(summary, [190, 760, 120]);

for (const sheetName of [
  "README",
  "Facilities",
  "ProgramOwners",
  "MetricCatalog",
  "DataContract",
  "BackendMapping",
  ...Object.keys(raw.sheets),
  "QA_Checks",
]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(
    path.join(outputDir, `${sheetName.replace(/[^A-Za-z0-9_-]/g, "_")}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const inspect = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
await fs.writeFile(path.join(outputDir, "formula-error-scan.ndjson"), inspect.ndjson || "");

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "DashboardSTN_backend_contract.xlsx"));
