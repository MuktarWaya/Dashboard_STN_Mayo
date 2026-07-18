/**
 * Dashboard ติดตามตัวชี้วัดตามนโยบาย คณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ กองสาธารณสุข อบจ.ปัตตานี
 * Google Apps Script Web API
 *
 * วิธีติดตั้ง:
 *   1. เปิดโปรเจกต์ Apps Script (script ID ตาม ENV.txt) แล้ววางโค้ดไฟล์นี้ทั้งไฟล์
 *   2. รันฟังก์ชัน setupSheets หนึ่งครั้ง (จะขอสิทธิ์ครั้งแรก)
 *      → สร้างชีต 7 แท็บ พร้อมข้อมูลตัวอย่าง (mock) ชุดเดียวกับ prototype
 *   3. Deploy > Manage deployments > แก้ deployment เดิม > New version
 *      (URL /exec เดิมใช้ได้ต่อ ไม่ต้องแก้หน้าเว็บ)
 *   4. ทดสอบ: เปิด <URL>/exec?action=all&year=2569&month=07 ต้องได้ JSON
 *
 * Endpoints:
 *   GET /exec?action=all&year=2569&month=07                → ข้อมูลครบทุก section (หน้า dashboard ใช้ตัวนี้)
 *   GET /exec?action=summary&year=2569&month=07            → KPI + 7 งาน
 *   GET /exec?action=facility-progress&year=2569&month=07  → ผลงานราย 13 รพ.สต.
 *   GET /exec?action=program&id=vaccine&year=2569          → งานวัคซีน + รายเดือน
 *   GET /exec?action=program&id=cancer&year=2569&month=07  → งานมะเร็ง + รายหน่วย
 *   GET /exec?action=feedback                               → รายการความคิดเห็นทั้งหมด (ใช้สรุปในที่ประชุม)
 *   POST /exec  body: {"action":"feedback", ...}            → บันทึกความคิดเห็นจากแบบฟอร์มบนหน้าเว็บ
 */

const SPREADSHEET_ID = '19Y4ColmVhopSLrIc3ppUr9kvpRpF4tBY4iI5h4aaTX4';
const CACHE_SECONDS = 60; // cache สั้น 1 นาที เพื่อให้ข้อมูลหน้า Dashboard ตามการแก้ชีตใกล้ real-time

const THAI_MONTHS = {
  1: 'มกราคม', 2: 'กุมภาพันธ์', 3: 'มีนาคม', 4: 'เมษายน', 5: 'พฤษภาคม', 6: 'มิถุนายน',
  7: 'กรกฎาคม', 8: 'สิงหาคม', 9: 'กันยายน', 10: 'ตุลาคม', 11: 'พฤศจิกายน', 12: 'ธันวาคม'
};

/**
 * เรียกหนึ่งครั้งจาก Apps Script editor เพื่ออนุญาตสิทธิ์อ่าน Spreadsheet
 * ฟังก์ชันนี้ไม่แก้ไขข้อมูลใน workbook
 */
function authorizeBackend() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Backend authorized for spreadsheet: ' + ss.getName());
  return { spreadsheetId: ss.getId(), spreadsheetName: ss.getName() };
}

// ตัวชี้วัดที่ใช้คำนวณ % ความก้าวหน้าของแต่ละงาน (ตัวตั้ง/ตัวหาร)
const PROGRESS_RULE = {
  ncd:     { num: 'rescreened',   den: 'suspected' },
  mch:     { num: 'done',         den: 'target' },
  ecd:     { num: 'screened',     den: 'target' },
  vaccine: { num: 'onSchedule',   den: 'target' },
  dental:  { num: 'served',       den: 'target' },
  elderly: { num: 'screened',     den: 'target' },
  cancer:  { num: 'kitsReceived', den: 'target' }
};

/* ======================================================================
 * Web API
 * ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};

  // เปิด URL ตรง ๆ (ไม่มี ?action=) → แสดงหน้าเว็บ
  //   ไม่ระบุ page          → dashboard (index.html)
  //   ?page=slides          → สไลด์นำเสนอ (presentation.html)
  if (!p.action) {
    const isSlides = p.page === 'slides';
    return HtmlService.createHtmlOutputFromFile(isSlides ? 'presentation' : 'index')
      .setTitle((isSlides ? 'นำเสนอ: ' : '') +
        'Dashboard ติดตามตัวชี้วัดตามนโยบาย คณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ กองสาธารณสุข อบจ.ปัตตานี')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const action = p.action;
  const year = Number(p.year) || 2569;
  const month = Number(p.month) || 7;

  // รายการความคิดเห็น — ไม่ cache เพื่อให้เห็นรายการใหม่ทันทีระหว่างประชุม
  if (action === 'feedback') {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      return jsonOut_(JSON.stringify({ feedback: readRows_(ss, 'Feedback') }));
    } catch (err) {
      return jsonOut_(JSON.stringify({ error: String(err && err.message || err) }));
    }
  }

  // รายชื่อผู้รับผิดชอบงาน — ไม่ cache
  if (action === 'owners') {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      return jsonOut_(JSON.stringify({ owners: readRows_(ss, 'ProgramOwnerDetails') }));
    } catch (err) {
      return jsonOut_(JSON.stringify({ error: String(err && err.message || err) }));
    }
  }

  const cacheKey = ['v3', action, p.id || '', year, month].join(':');
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return jsonOut_(cached);

  let result;
  try {
    const data = buildData_(year, month);
    switch (action) {
      case 'all':
        result = data;
        break;
      case 'summary':
        result = { meta: data.meta, kpi: data.kpi, programs: data.programs };
        break;
      case 'facility-progress':
        result = { meta: data.meta, facilities: data.facilities, facilityProgress: data.facilityProgress };
        break;
      case 'program': {
        const prog = data.programs.filter(function (x) { return x.id === p.id; })[0];
        if (!prog) throw new Error('ไม่พบงาน id=' + p.id);
        result = {
          meta: data.meta,
          program: prog,
          facilities: data.facilities,
          facilityDetails: (data.programFacilityDetails && data.programFacilityDetails[p.id]) || []
        };
        if (p.id === 'vaccine') result.monthlyProgress = data.monthlyProgress.vaccine;
        if (p.id === 'cancer') result.cancerTracking = data.cancerTracking;
        break;
      }
      default:
        throw new Error('ไม่รู้จัก action=' + action);
    }
  } catch (err) {
    return jsonOut_(JSON.stringify({ error: String(err && err.message || err) }));
  }

  const body = JSON.stringify(result);
  try { cache.put(cacheKey, body, CACHE_SECONDS); } catch (ignore) {} // ข้อมูลใหญ่เกิน 100KB จะ cache ไม่ได้ ก็ข้ามไป
  return jsonOut_(body);
}

function jsonOut_(body) {
  return ContentService.createTextOutput(typeof body === 'string' ? body : JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * รับข้อมูลจากแบบฟอร์มบนหน้า dashboard
 *   action=feedback  → บันทึกความคิดเห็น
 *   action=owner     → บันทึกผู้รับผิดชอบงาน
 * หมายเหตุ: ฝั่งเว็บส่งเป็น POST แบบ text/plain (simple request) เพื่อเลี่ยง CORS preflight
 */
function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_(JSON.stringify({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)' }));
  }
  if (!p || !p.action) {
    return jsonOut_(JSON.stringify({ error: 'ไม่รู้จัก action' }));
  }

  const clip = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };

  /* -------- feedback -------- */
  if (p.action === 'feedback') {
    const message = String(p.message || '').trim();
    if (!message) {
      return jsonOut_(JSON.stringify({ error: 'กรุณากรอกรายละเอียดความคิดเห็น' }));
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sh = ss.getSheetByName('Feedback');
      if (!sh) {
        sh = ss.insertSheet('Feedback');
        sh.getRange(1, 1, 1, 9).setValues([[
          'timestamp', 'name', 'organization', 'role', 'dashboard_section',
          'feedback_type', 'priority', 'message', 'client_saved_at'
        ]]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      sh.appendRow([
        Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
        clip(p.name, 200) || '(ไม่ระบุชื่อ)',
        clip(p.organization, 200),
        clip(p.role, 100),
        clip(p.section, 100),
        clip(p.type, 100),
        clip(p.priority, 50),
        clip(message, 3000),
        clip(p.clientSavedAt, 50)
      ]);
    } finally {
      lock.releaseLock();
    }
    return jsonOut_(JSON.stringify({ ok: true }));
  }

  /* -------- owner -------- */
  if (p.action === 'owner') {
    const persons = Array.isArray(p.persons) ? p.persons : [];
    if (!persons.length) {
      return jsonOut_(JSON.stringify({ error: 'ไม่พบข้อมูลผู้รับผิดชอบ' }));
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sh = ss.getSheetByName('ProgramOwnerDetails');
      if (!sh) {
        sh = ss.insertSheet('ProgramOwnerDetails');
        sh.getRange(1, 1, 1, 8).setValues([[
          'timestamp', 'program_id', 'program_name', 'role', 'full_name', 'position', 'facility_name', 'phone'
        ]]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      const ts = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
      persons.forEach(function (person) {
        sh.appendRow([
          ts,
          clip(person.program_id, 50),
          clip(person.program_name, 200),
          clip(person.role, 100),
          clip(person.full_name, 200),
          clip(person.position, 200),
          clip(person.facility_name, 200),
          clip(person.phone, 50)
        ]);
      });
    } finally {
      lock.releaseLock();
    }
    return jsonOut_(JSON.stringify({ ok: true, saved: persons.length }));
  }

  return jsonOut_(JSON.stringify({ error: 'ไม่รู้จัก action' }));
}

/* ======================================================================
 * ประกอบข้อมูลจากชีตให้ตรงโครงสร้าง data/sample-indicators.json
 * ====================================================================== */

function buildData_(year, month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (hasDataContractSheets_(ss)) {
    return buildDataFromContract_(ss, year, month);
  }
  return buildLegacyData_(year, month);
}

function hasDataContractSheets_(ss) {
  const required = ['Facilities', 'ProgramOwners', 'MetricCatalog',
    'Data_NCD', 'Data_MCH', 'Data_Vaccine', 'Data_ECD', 'Data_Dental', 'Data_Elderly', 'Data_Cancer'];
  const ok = required.every(function (name) { return !!ss.getSheetByName(name); });
  if (!ok) return false;
  const headers = getHeaders_(ss, 'Data_Cancer');
  return headers.indexOf('facility_code') >= 0 && headers.indexOf('women_30_60_target') >= 0;
}

function buildDataFromContract_(ss, year, month) {
  const facilities = readRows_(ss, 'Facilities')
    .filter(function (r) { return String(r.active).toLowerCase() !== 'false'; })
    .map(function (r) {
      return {
        id: r.facility_code || splitFacility_(r.facility_id).code,
        name: r.facility_name || splitFacility_(r.facility_id).name
      };
    });

  const owners = readRows_(ss, 'ProgramOwners');
  const metricsCatalog = readRows_(ss, 'MetricCatalog');
  const sheetRows = {};
  ['Data_NCD', 'Data_MCH', 'Data_Vaccine', 'Data_ECD', 'Data_Dental', 'Data_Elderly', 'Data_Cancer']
    .forEach(function (sheetName) {
      sheetRows[sheetName] = readRows_(ss, sheetName)
        .filter(function (r) { return Number(r.year) === year && Number(r.month) === month; })
        .map(normalizeContractRow_);
    });

  const metricValue = function (metric) {
    const rows = sheetRows[metric.source_sheet] || [];
    return aggregateMetric_(rows, metric);
  };

  const programs = owners.map(function (o) {
    const catalog = metricsCatalog.filter(function (m) { return m.program_id === o.program_id; });
    const metrics = catalog.map(function (m) {
      return {
        key: m.metric_key,
        label: m.metric_label,
        value: metricValue(m).displayValue
      };
    });
    const primary = catalog.filter(function (m) { return String(m.dashboard_role || '').toLowerCase() === 'primary'; });
    const progressParts = primary.map(function (m) { return metricValue(m).progressPercent; })
      .filter(function (n) { return !isNaN(n); });
    const progressPercent = progressParts.length
      ? round1_(progressParts.reduce(function (s, n) { return s + n; }, 0) / progressParts.length)
      : 0;
    return {
      id: o.program_id,
      name: o.program_name,
      icon: o.icon || '',
      progressPercent: progressPercent,
      metrics: metrics
    };
  });

  // รายละเอียดราย รพ.สต. ของทั้ง 7 งาน — ใช้ source_sheet/source_column
  // จาก MetricCatalog ชุดเดียวกับที่คำนวณภาพรวม เพื่อไม่ให้ frontend สร้างสูตรซ้ำ
  const programFacilityDetails = {};
  owners.forEach(function (o) {
    const catalog = metricsCatalog.filter(function (m) { return m.program_id === o.program_id; });
    const primary = catalog.filter(function (m) {
      return String(m.dashboard_role || '').toLowerCase() === 'primary';
    });
    const sourceSheet = catalog.length ? catalog[0].source_sheet : '';
    const rows = sheetRows[sourceSheet] || [];

    programFacilityDetails[o.program_id] = rows.map(function (row) {
      const metrics = catalog.map(function (metric) {
        const result = rowMetricValue_(row, metric);
        return {
          key: metric.metric_key,
          label: metric.metric_label,
          value: result.displayValue
        };
      });
      const progressParts = primary.map(function (metric) {
        return rowMetricValue_(row, metric).progressPercent;
      }).filter(function (value) { return !isNaN(value); });

      return {
        facilityId: row.facility_code || splitFacility_(row.facility_id).code,
        progressPercent: progressParts.length
          ? round1_(progressParts.reduce(function (sum, value) { return sum + value; }, 0) / progressParts.length)
          : 0,
        metrics: metrics
      };
    });
  });

  const vaccineRows = sheetRows.Data_Vaccine || [];
  const cancerRows = sheetRows.Data_Cancer || [];
  const facilityProgress = facilities.map(function (f) {
    const vac = findByFacility_(vaccineRows, f.id);
    const can = findByFacility_(cancerRows, f.id);
    const vaccineTarget = num_(vac.fully1_target);
    const vaccineDone = num_(vac.fully1_done);
    const vaccinePercent = num_(vac.fully1_percent) || pct_(vaccineDone, vaccineTarget);
    const cancerTarget = num_(can.women_30_60_target);
    const cancerKits = num_(can.hpv_kits_returned) || num_(can.hpv_kits_distributed);
    const cancerPercent = pct_(cancerKits, cancerTarget);
    return {
      facilityId: f.id,
      vaccineTarget: vaccineTarget,
      vaccineOnSchedule: vaccineDone,
      vaccinePercent: vaccinePercent,
      cancerTarget: cancerTarget,
      cancerKits: cancerKits,
      cancerPercent: cancerPercent,
      overallPercent: round1_((vaccinePercent + cancerPercent) / 2)
    };
  });

  const vaccineAll = readRows_(ss, 'Data_Vaccine')
    .filter(function (r) { return Number(r.year) === year; })
    .map(normalizeContractRow_);
  const groupedMonths = groupByMonth_(vaccineAll);
  let cumulative = 0;
  const months = groupedMonths.map(function (g) {
    const done = sum_(g.rows, 'fully1_done');
    const target = sum_(g.rows, 'fully1_target');
    cumulative += done;
    return {
      month: year + '-' + pad2_(g.month),
      label: monthLabel_(year, g.month),
      vaccinatedInMonth: done,
      cumulative: cumulative,
      cumulativePercent: target ? round1_(cumulative / target * 100) : 0
    };
  });
  const targetTotal = groupedMonths.length ? sum_(groupedMonths[groupedMonths.length - 1].rows, 'fully1_target') : 0;

  const byFacility = cancerRows.map(function (r) {
    const target = num_(r.women_30_60_target);
    const kitsReceived = num_(r.hpv_kits_returned) || num_(r.hpv_kits_distributed);
    return {
      facilityId: r.facility_code,
      target: target,
      kitsReceived: kitsReceived,
      resultNormal: num_(r.hpv_normal),
      resultAbnormal: num_(r.hpv_abnormal),
      diagnosedReferred: num_(r.ca_cx_diagnosed),
      pendingResult: num_(r.pending)
    };
  });
  const cSum = byFacility.reduce(function (a, r) {
    a.target += r.target; a.kitsReceived += r.kitsReceived;
    a.resultNormal += r.resultNormal; a.resultAbnormal += r.resultAbnormal;
    a.diagnosedReferred += r.diagnosedReferred; a.pendingResult += r.pendingResult;
    return a;
  }, { target: 0, kitsReceived: 0, resultNormal: 0, resultAbnormal: 0, diagnosedReferred: 0, pendingResult: 0 });
  cSum.kitsNotReceived = cSum.target - cSum.kitsReceived;

  const avg = programs.length
    ? round1_(programs.reduce(function (s, p) { return s + p.progressPercent; }, 0) / programs.length)
    : 0;

  return {
    meta: {
      district: 'มายอ',
      fiscalYear: year,
      asOfMonth: year + '-' + pad2_(month),
      asOfLabel: 'ข้อมูล ณ เดือน' + (THAI_MONTHS[month] || month) + ' ' + year +
        ' (ปีงบประมาณ ' + year + ') — ดึงจาก Google Sheets เมื่อ ' + thaiDateTime_(new Date()),
      isMockData: false,
      statusThresholds: { achieved: 80, watch: 65 },
      statusLabels: { achieved: 'ถึงเป้า', watch: 'เฝ้าระวัง', urgent: 'ต้องเร่งติดตาม' }
    },
    kpi: {
      programCount: programs.length,
      facilityCount: facilities.length,
      averageProgressPercent: avg,
      urgentPrograms: programs
        .filter(function (p) { return p.progressPercent < 65; })
        .map(function (p) { return p.name; })
    },
    facilities: facilities,
    programs: programs,
    programFacilityDetails: programFacilityDetails,
    facilityProgress: facilityProgress,
    monthlyProgress: { vaccine: { targetTotal: targetTotal, unit: 'ราย (สะสม)', months: months } },
    cancerTracking: {
      programId: 'cancer',
      description: 'การคัดกรองมะเร็ง ปีงบประมาณ ' + year,
      summary: cSum,
      byFacility: byFacility
    }
  };
}

function buildLegacyData_(year, month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const facilities = readRows_(ss, 'Facilities')
    .filter(function (r) { return String(r.active).toLowerCase() !== 'false'; })
    .map(function (r) { return { id: r.facility_id, name: r.facility_name }; });

  const owners = readRows_(ss, 'ProgramOwners');
  const summaryRows = readRows_(ss, 'MonthlySummary')
    .filter(function (r) { return Number(r.year) === year && Number(r.month) === month; });

  // การ์ด 7 งาน — เรียงตามลำดับใน ProgramOwners, ตัวชี้วัดเรียงตามลำดับแถวในชีต
  const programs = owners.map(function (o) {
    const metrics = summaryRows
      .filter(function (r) { return r.program_id === o.program_id; })
      .map(function (r) { return { key: r.metric_key, label: r.metric_label, value: Number(r.value) }; });
    const rule = PROGRESS_RULE[o.program_id] || {};
    const num = pick_(metrics, rule.num);
    const den = pick_(metrics, rule.den);
    return {
      id: o.program_id,
      name: o.program_name,
      icon: o.icon || '',
      progressPercent: den ? round1_(num / den * 100) : 0,
      metrics: metrics
    };
  });

  // ผลงานรายหน่วยบริการ (วัคซีน + มะเร็ง)
  const fpRows = readRows_(ss, 'FacilityProgress')
    .filter(function (r) { return Number(r.year) === year && Number(r.month) === month; });
  const facilityProgress = facilities.map(function (f) {
    const vac = fpRows.filter(function (r) { return r.facility_id === f.id && r.program_id === 'vaccine'; })[0] || {};
    const can = fpRows.filter(function (r) { return r.facility_id === f.id && r.program_id === 'cancer'; })[0] || {};
    const vPct = vac.target ? round1_(Number(vac.done) / Number(vac.target) * 100) : 0;
    const cPct = can.target ? round1_(Number(can.done) / Number(can.target) * 100) : 0;
    return {
      facilityId: f.id,
      vaccineTarget: Number(vac.target) || 0,
      vaccineOnSchedule: Number(vac.done) || 0,
      vaccinePercent: vPct,
      cancerTarget: Number(can.target) || 0,
      cancerKits: Number(can.done) || 0,
      cancerPercent: cPct,
      overallPercent: round1_((vPct + cPct) / 2)
    };
  });

  // วัคซีนรายเดือน (ทั้งปีงบประมาณ ตามลำดับแถวในชีต)
  const vmRows = readRows_(ss, 'VaccineMonthly')
    .filter(function (r) { return Number(r.year) === year; });
  const targetTotal = vmRows.length ? Number(vmRows[0].target_total) : 0;
  const months = vmRows.map(function (r) {
    return {
      month: year + '-' + pad2_(r.month),
      label: r.month_label,
      vaccinatedInMonth: Number(r.vaccinated_in_month),
      cumulative: Number(r.cumulative),
      cumulativePercent: targetTotal ? round1_(Number(r.cumulative) / targetTotal * 100) : 0
    };
  });

  // งานมะเร็งรายหน่วย + สรุประดับอำเภอ
  const caRows = readRows_(ss, 'CancerTracking')
    .filter(function (r) { return Number(r.year) === year && Number(r.month) === month; });
  const byFacility = caRows.map(function (r) {
    return {
      facilityId: r.facility_id,
      target: Number(r.target),
      kitsReceived: Number(r.kits_received),
      resultNormal: Number(r.result_normal),
      resultAbnormal: Number(r.result_abnormal),
      diagnosedReferred: Number(r.diagnosed_referred),
      pendingResult: Number(r.pending_result)
    };
  });
  const cSum = byFacility.reduce(function (a, r) {
    a.target += r.target; a.kitsReceived += r.kitsReceived;
    a.resultNormal += r.resultNormal; a.resultAbnormal += r.resultAbnormal;
    a.diagnosedReferred += r.diagnosedReferred; a.pendingResult += r.pendingResult;
    return a;
  }, { target: 0, kitsReceived: 0, resultNormal: 0, resultAbnormal: 0, diagnosedReferred: 0, pendingResult: 0 });
  cSum.kitsNotReceived = cSum.target - cSum.kitsReceived;

  const avg = programs.length
    ? round1_(programs.reduce(function (s, p) { return s + p.progressPercent; }, 0) / programs.length)
    : 0;

  return {
    meta: {
      district: 'มายอ',
      fiscalYear: year,
      asOfMonth: year + '-' + pad2_(month),
      asOfLabel: 'ข้อมูล ณ เดือน' + (THAI_MONTHS[month] || month) + ' ' + year +
        ' (ปีงบประมาณ ' + year + ') — ดึงจาก Google Sheets เมื่อ ' + thaiDateTime_(new Date()),
      isMockData: false,
      statusThresholds: { achieved: 80, watch: 65 },
      statusLabels: { achieved: 'ถึงเป้า', watch: 'เฝ้าระวัง', urgent: 'ต้องเร่งติดตาม' }
    },
    kpi: {
      programCount: programs.length,
      facilityCount: facilities.length,
      averageProgressPercent: avg,
      urgentPrograms: programs
        .filter(function (p) { return p.progressPercent < 65; })
        .map(function (p) { return p.name; })
    },
    facilities: facilities,
    programs: programs,
    facilityProgress: facilityProgress,
    monthlyProgress: { vaccine: { targetTotal: targetTotal, unit: 'ราย (สะสม)', months: months } },
    cancerTracking: {
      programId: 'cancer',
      description: 'การคัดกรองมะเร็ง (อุปกรณ์เก็บสิ่งส่งตรวจด้วยตนเอง) ปีงบประมาณ ' + year,
      summary: cSum,
      byFacility: byFacility
    }
  };
}

/* ---------- helpers ---------- */

function readRows_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต "' + name + '" — รัน setupSheets ก่อน');
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  let headerRow = 0;
  const first = values[0].map(String);
  const second = values.length > 1 ? values[1].map(String) : [];
  if (first.indexOf('year') < 0 && second.indexOf('year') >= 0) {
    headerRow = 1;
  }
  const head = values[headerRow].map(String);
  return values.slice(headerRow + 1)
    .filter(function (row) { return String(row[0]) !== ''; })
    .map(function (row) {
      const o = {};
      head.forEach(function (h, i) { o[h] = row[i]; });
      return o;
    });
}

function getHeaders_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return [];
  const rowCount = Math.min(2, sh.getLastRow());
  const values = sh.getRange(1, 1, rowCount, sh.getLastColumn()).getValues();
  const first = values[0].map(String);
  const second = values.length > 1 ? values[1].map(String) : [];
  return first.indexOf('year') < 0 && second.indexOf('year') >= 0 ? second : first;
}

function normalizeContractRow_(r) {
  if (!r.facility_code || !r.facility_name) {
    const f = splitFacility_(r.facility_id);
    r.facility_code = r.facility_code || f.code;
    r.facility_name = r.facility_name || f.name;
  }
  return r;
}

function splitFacility_(facilityId) {
  const text = String(facilityId || '');
  const parts = text.split(':');
  return {
    code: (parts[0] || text).trim(),
    name: (parts.slice(1).join(':') || text).trim()
  };
}

function findByFacility_(rows, facilityCode) {
  return rows.filter(function (r) {
    return String(r.facility_code || splitFacility_(r.facility_id).code) === String(facilityCode);
  })[0] || {};
}

function rowMetricValue_(row, metric) {
  const source = metric.source_column;
  const den = metric.denominator_key;
  const valueType = String(metric.value_type || '').toLowerCase();
  const value = num_(row[source]);

  if (valueType === 'percent') {
    return { displayValue: value, progressPercent: value };
  }

  const denominator = den ? num_(row[den]) : 0;
  return {
    displayValue: value,
    progressPercent: denominator ? pct_(value, denominator) : value
  };
}

function aggregateMetric_(rows, metric) {
  const source = metric.source_column;
  const den = metric.denominator_key;
  const valueType = String(metric.value_type || '').toLowerCase();

  if (valueType === 'percent') {
    const denSum = sum_(rows, den);
    if (den && denSum > 0) {
      const weighted = rows.reduce(function (s, r) {
        return s + (num_(r[den]) * num_(r[source]) / 100);
      }, 0);
      const pct = round1_(weighted / denSum * 100);
      return { displayValue: pct, progressPercent: pct };
    }
    const values = rows.map(function (r) { return num_(r[source]); })
      .filter(function (n) { return !isNaN(n) && n > 0; });
    const avg = values.length ? round1_(values.reduce(function (s, n) { return s + n; }, 0) / values.length) : 0;
    return { displayValue: avg, progressPercent: avg };
  }

  const value = sum_(rows, source);
  const denominator = den ? sum_(rows, den) : 0;
  return {
    displayValue: value,
    progressPercent: denominator ? pct_(value, denominator) : value
  };
}

function groupByMonth_(rows) {
  const bucket = {};
  rows.forEach(function (r) {
    const m = Number(r.month);
    if (!bucket[m]) bucket[m] = [];
    bucket[m].push(r);
  });
  return Object.keys(bucket).map(Number).sort(function (a, b) { return fiscalMonthOrder_(a) - fiscalMonthOrder_(b); })
    .map(function (m) { return { month: m, rows: bucket[m] }; });
}

function fiscalMonthOrder_(m) {
  return m >= 10 ? m - 9 : m + 3;
}

function monthLabel_(year, month) {
  const short = {
    1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
    7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
  };
  const yy = month >= 10 ? String(year - 1).slice(-2) : String(year).slice(-2);
  return (short[month] || month) + ' ' + yy;
}

function sum_(rows, key) {
  return rows.reduce(function (s, r) { return s + num_(r[key]); }, 0);
}

function pct_(num, den) {
  return den ? round1_(num / den * 100) : 0;
}

function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function pick_(metrics, key) {
  const m = metrics.filter(function (x) { return x.key === key; })[0];
  return m ? Number(m.value) : 0;
}

function round1_(n) { return Math.round(n * 10) / 10; }
function pad2_(n) { return ('0' + Number(n)).slice(-2); }

function thaiDateTime_(d) {
  const beYear = Number(Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy')) + 543;
  return Utilities.formatDate(d, 'Asia/Bangkok', 'd/M/') + beYear +
    Utilities.formatDate(d, 'Asia/Bangkok', ' HH:mm น.');
}

/* ======================================================================
 * setupSheets — สร้างชีต 7 แท็บ + ข้อมูลตัวอย่าง (รันครั้งเดียว)
 * ชีตไหนมีอยู่แล้วจะข้าม ไม่เขียนทับ (ลบแท็บทิ้งก่อนถ้าต้องการ seed ใหม่)
 * ====================================================================== */

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const Y = 2569, M = 7;

  seed_(ss, 'Facilities',
    ['facility_id', 'facility_name', 'subdistrict', 'active'],
    range_(1, 13).map(function (i) {
      return ['F' + pad2_(i), 'รพ.สต. หน่วยบริการ ' + pad2_(i), '(รอยืนยัน)', true];
    }));

  seed_(ss, 'ProgramOwners',
    ['program_id', 'program_name', 'icon', 'owner_name', 'phone', 'update_frequency'],
    [
      ['ncd', 'งานโรคไม่ติดต่อเรื้อรัง (NCDs)', '🩺', '(รอระบุ)', '', 'รายเดือน'],
      ['mch', 'งานอนามัยแม่และเด็ก', '🤱', '(รอระบุ)', '', 'รายเดือน'],
      ['ecd', 'งานเด็กปฐมวัย', '🧒', '(รอระบุ)', '', 'รายเดือน'],
      ['vaccine', 'งานวัคซีน', '💉', '(รอระบุ)', '', 'รายเดือน'],
      ['dental', 'งานทันตกรรม', '🦷', '(รอระบุ)', '', 'รายเดือน'],
      ['elderly', 'งานผู้สูงอายุ', '🧓', '(รอระบุ)', '', 'รายเดือน'],
      ['cancer', 'งานมะเร็ง', '🎗️', '(รอระบุ)', '', 'รายเดือน']
    ]);

  seed_(ss, 'MonthlySummary',
    ['year', 'month', 'program_id', 'metric_key', 'metric_label', 'value'],
    [
      [Y, M, 'ncd', 'suspected', 'กลุ่มสงสัยป่วย', 1240],
      [Y, M, 'ncd', 'rescreened', 'การตรวจซ้ำ', 862],
      [Y, M, 'ncd', 'pending', 'คงค้าง', 378],
      [Y, M, 'mch', 'target', 'เป้าหมาย', 420],
      [Y, M, 'mch', 'done', 'ดำเนินการแล้ว', 356],
      [Y, M, 'mch', 'pending', 'คงค้าง', 64],
      [Y, M, 'ecd', 'target', 'เป้าหมาย', 1850],
      [Y, M, 'ecd', 'screened', 'คัดกรอง', 1544],
      [Y, M, 'ecd', 'followUp', 'ติดตามต่อ', 212],
      [Y, M, 'ecd', 'pending', 'คงค้าง', 306],
      [Y, M, 'vaccine', 'target', 'เป้าหมายเด็ก 0-5 ปี', 2140],
      [Y, M, 'vaccine', 'onSchedule', 'ฉีดตามเกณฑ์', 1645],
      [Y, M, 'vaccine', 'delayed', 'ล่าช้า', 262],
      [Y, M, 'vaccine', 'refused', 'ปฏิเสธ', 98],
      [Y, M, 'vaccine', 'unknownPending', 'ไม่ทราบสถานะ/คงค้าง', 135],
      [Y, M, 'dental', 'target', 'เป้าหมาย', 3200],
      [Y, M, 'dental', 'served', 'รับบริการแล้ว', 1728],
      [Y, M, 'dental', 'pending', 'คงค้าง', 1472],
      [Y, M, 'elderly', 'target', 'เป้าหมาย', 2860],
      [Y, M, 'elderly', 'screened', 'คัดกรอง', 2377],
      [Y, M, 'elderly', 'followUp', 'ติดตามต่อ', 401],
      [Y, M, 'elderly', 'pending', 'คงค้าง', 483],
      [Y, M, 'cancer', 'target', 'เป้าหมายทั้งหมด', 1560],
      [Y, M, 'cancer', 'kitsReceived', 'ได้รับอุปกรณ์', 1135],
      [Y, M, 'cancer', 'resultNormal', 'ผลการตรวจปกติ', 812],
      [Y, M, 'cancer', 'resultAbnormal', 'ผลการตรวจผิดปกติ', 47],
      [Y, M, 'cancer', 'diagnosedReferred', 'ได้รับการวินิจฉัยและส่งต่อ', 38],
      [Y, M, 'cancer', 'pendingResult', 'รอผล/คงค้าง', 276]
    ]);

  const vac = [
    ['F01', 210, 181], ['F02', 185, 145], ['F03', 160, 146], ['F04', 150, 94],
    ['F05', 175, 131], ['F06', 168, 140], ['F07', 142, 98], ['F08', 130, 75],
    ['F09', 190, 167], ['F10', 158, 120], ['F11', 172, 140], ['F12', 145, 95], ['F13', 155, 113]
  ];
  const can = [
    ['F01', 152, 125, 92, 5, 4, 28], ['F02', 138, 102, 74, 4, 3, 24], ['F03', 118, 101, 76, 4, 4, 21],
    ['F04', 110, 64, 44, 3, 2, 17], ['F05', 128, 90, 65, 4, 3, 21], ['F06', 122, 97, 71, 4, 3, 22],
    ['F07', 104, 69, 48, 3, 2, 18], ['F08', 95, 50, 34, 2, 2, 14], ['F09', 140, 118, 88, 5, 4, 25],
    ['F10', 115, 83, 60, 3, 3, 20], ['F11', 125, 97, 71, 4, 3, 22], ['F12', 105, 65, 45, 3, 2, 17],
    ['F13', 108, 74, 44, 3, 3, 27]
  ];

  seed_(ss, 'FacilityProgress',
    ['year', 'month', 'facility_id', 'program_id', 'target', 'done', 'pending'],
    vac.map(function (r) { return [Y, M, r[0], 'vaccine', r[1], r[2], r[1] - r[2]]; })
      .concat(can.map(function (r) { return [Y, M, r[0], 'cancer', r[1], r[2], r[1] - r[2]]; })));

  seed_(ss, 'VaccineMonthly',
    ['year', 'month', 'month_label', 'vaccinated_in_month', 'cumulative', 'target_total'],
    [
      [Y, 10, 'ต.ค. 68', 175, 175, 2140], [Y, 11, 'พ.ย. 68', 178, 353, 2140],
      [Y, 12, 'ธ.ค. 68', 173, 526, 2140], [Y, 1, 'ม.ค. 69', 167, 693, 2140],
      [Y, 2, 'ก.พ. 69', 165, 858, 2140], [Y, 3, 'มี.ค. 69', 161, 1019, 2140],
      [Y, 4, 'เม.ย. 69', 162, 1181, 2140], [Y, 5, 'พ.ค. 69', 154, 1335, 2140],
      [Y, 6, 'มิ.ย. 69', 159, 1494, 2140], [Y, 7, 'ก.ค. 69', 151, 1645, 2140]
    ]);

  seed_(ss, 'CancerTracking',
    ['year', 'month', 'facility_id', 'target', 'kits_received', 'result_normal',
      'result_abnormal', 'diagnosed_referred', 'pending_result'],
    can.map(function (r) { return [Y, M, r[0], r[1], r[2], r[3], r[4], r[5], r[6]]; }));

  seed_(ss, 'AuditLog',
    ['timestamp', 'user_email', 'sheet', 'cell', 'old_value', 'new_value'], []);

  seed_(ss, 'Feedback',
    ['timestamp', 'name', 'organization', 'role', 'dashboard_section',
      'feedback_type', 'priority', 'message', 'client_saved_at'], []);

  seed_(ss, 'ProgramOwnerDetails',
    ['timestamp', 'program_id', 'program_name', 'role', 'full_name', 'position', 'facility_name', 'phone'], []);

  CacheService.getScriptCache().removeAll(['v1:all::2569:7']);
  Logger.log('setupSheets เสร็จสิ้น: สร้าง/ตรวจสอบ 7 ชีตเรียบร้อย');
}

function seed_(ss, name, headers, rows) {
  if (ss.getSheetByName(name)) return; // มีอยู่แล้ว ไม่เขียนทับ
  const sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.setFrozenRows(1);
}

function range_(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/* ======================================================================
 * setupProgramDataSheets — สร้างชีตข้อมูลรายงานแยกตาม 7 งาน (รันครั้งเดียว)
 * ชีตตั้งต้นสำหรับให้ผู้รับผิดชอบแต่ละงานทบทวนและปรับแก้คอลัมน์ในที่ประชุม
 * ====================================================================== */

function setupProgramDataSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const Y = 2569, M = 7;
  const fids = ['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13'];

  /* 1. งานโรคไม่ติดต่อเรื้อรัง (NCDs) */
  seed_(ss, 'Data_NCD',
    ['year','month','facility_id',
     'สงสัยป่วย_DM','สงสัยป่วย_HT',
     'ตรวจซ้ำ_DM','ตรวจซ้ำ_HT',
     'ยืนยันป่วย_DM','ยืนยันป่วย_HT',
     'เข้าระบบดูแลต่อเนื่อง','คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 2. งานอนามัยแม่และเด็ก (MCH) */
  seed_(ss, 'Data_MCH',
    ['year','month','facility_id',
     'เป้าหมายหญิงตั้งครรภ์',
     'ฝากครรภ์ครั้งแรก<12สัปดาห์','ฝากครรภ์ครบ5ครั้ง','ฝากครรภ์คุณภาพ',
     'เยี่ยมหลังคลอด_48ชม','เยี่ยมหลังคลอด_7วัน','เยี่ยมหลังคลอด_42วัน',
     'คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 3. งานเด็กปฐมวัย (ECD) */
  seed_(ss, 'Data_ECD',
    ['year','month','facility_id',
     'เป้าหมาย_9-72เดือน',
     'คัดกรองพัฒนาการ','สมวัย','สงสัยล่าช้า',
     'ติดตาม_1เดือน','ส่งต่อเพื่อวินิจฉัย','คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 4. งานวัคซีน */
  seed_(ss, 'Data_Vaccine',
    ['year','month','facility_id',
     'เป้าหมาย_0-5ปี','ฉีดตามเกณฑ์','ล่าช้า','ปฏิเสธ','ไม่ทราบสถานะ',
     'คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 5. งานทันตกรรม */
  seed_(ss, 'Data_Dental',
    ['year','month','facility_id',
     'เป้าหมาย',
     'ตรวจสุขภาพช่องปาก','ทาฟลูออไรด์','อุดฟัน','ถอนฟัน','ขูดหินปูน',
     'รับบริการรวม','คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 6. งานผู้สูงอายุ */
  seed_(ss, 'Data_Elderly',
    ['year','month','facility_id',
     'เป้าหมาย','คัดกรองสุขภาพ',
     'ADL_ปกติ','ADL_ติดบ้าน','ADL_ติดเตียง',
     'เสี่ยงล้ม','ภาวะสมองเสื่อม','ภาวะซึมเศร้า',
     'ติดตามต่อ','คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  /* 7. งานมะเร็ง */
  seed_(ss, 'Data_Cancer',
    ['year','month','facility_id',
     'เป้าหมาย_สตรี30-60ปี',
     'แจกชุดตรวจHPV','ส่งคืนชุดตรวจ',
     'ผลHPV_ปกติ','ผลHPV_ผิดปกติ','นัดตรวจซ้ำ',
     'วินิจฉัย_CA_Cx','ตรวจมะเร็งเต้านม_CBE',
     'คงค้าง','หมายเหตุ'],
    fids.map(function(f){ return [Y,M,f,0,0,0,0,0,0,0,0,0,'(รอกรอก)']; }));

  Logger.log('setupProgramDataSheets เสร็จสิ้น: สร้างชีตข้อมูลตั้งต้น 7 งาน');
}

/* ======================================================================
 * setupDataContractSheets — สร้างชีต backend contract รุ่นใหม่
 * ใช้หัวคอลัมน์เดียวกับ outputs/dashboard-contract/DashboardSTN_backend_contract.xlsx
 * ====================================================================== */

function setupDataContractSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const Y = 2569, M = 7;
  const facilities = readRows_(ss, 'Facilities').map(function (r) {
    const f = splitFacility_(r.facility_id);
    return {
      code: r.facility_code || f.code,
      id: r.facility_id || (f.code + ':' + f.name),
      name: r.facility_name || f.name
    };
  });

  seedContractSheet_(ss, 'ProgramOwners',
    ['program_id','program_name','program_short','icon','owner_name','phone','update_frequency','source_sheet'],
    [
      ['ncd','งานโรคไม่ติดต่อเรื้อรัง (NCDs)','NCDs','🩺','(รอระบุ)','','monthly','Data_NCD'],
      ['mch','งานอนามัยแม่และเด็ก','MCH','🤱','(รอระบุ)','','monthly','Data_MCH'],
      ['vaccine','งานวัคซีน','Vaccine','💉','(รอระบุ)','','monthly','Data_Vaccine'],
      ['ecd','งานเด็กปฐมวัย','ECD','🧒','(รอระบุ)','','monthly','Data_ECD'],
      ['dental','งานทันตกรรม','Dental','🦷','(รอระบุ)','','monthly','Data_Dental'],
      ['elderly','งานผู้สูงอายุ','Elderly','🧓','(รอระบุ)','','monthly','Data_Elderly'],
      ['cancer','งานมะเร็ง','Cancer','🎗️','(รอระบุ)','','monthly','Data_Cancer']
    ]);

  seedContractSheet_(ss, 'MetricCatalog',
    ['program_id','metric_key','metric_label','value_type','denominator_key','source_column','source_sheet','dashboard_role','target_percent'],
    [
      ['ncd','dm_confirm_percent','ติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยเบาหวาน','percent','dm_suspected','dm_confirm_percent','Data_NCD','watch',80],
      ['ncd','hba1c_percent','ผู้ป่วยเบาหวานได้รับ HbA1c อย่างน้อย 1 ครั้ง/ปี','percent','dm_patient_total','hba1c_percent','Data_NCD','primary',80],
      ['ncd','ht_confirm_percent','ติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยความดันโลหิตสูง','percent','ht_suspected','ht_confirm_percent','Data_NCD','watch',80],
      ['ncd','ckd_screen_percent','ผู้ป่วย DM/HT ได้รับคัดกรองโรคไตเรื้อรัง','percent','dm_ht_patient_total','ckd_screen_percent','Data_NCD','primary',80],
      ['mch','anc_before_12w','ฝากครรภ์ครั้งแรกก่อน 12 สัปดาห์','count','delivered_total','anc_before_12w','Data_MCH','primary',80],
      ['mch','anc_5_quality','ฝากครรภ์ครบ 5 ครั้งตามเกณฑ์','count','delivered_total','anc_5_quality','Data_MCH','primary',80],
      ['mch','postpartum_visit_1_7d','เยี่ยมหลังคลอดครั้งที่ 1 ภายใน 1-7 วัน','count','delivered_total','postpartum_visit_1_7d','Data_MCH','watch',80],
      ['vaccine','fully1_percent','Fully 1 ปี','percent','fully1_target','fully1_percent','Data_Vaccine','primary',80],
      ['vaccine','fully2_percent','Fully 2 ปี','percent','fully2_target','fully2_percent','Data_Vaccine','primary',80],
      ['vaccine','fully3_percent','Fully 3 ปี','percent','fully3_target','fully3_percent','Data_Vaccine','watch',80],
      ['vaccine','fully5_percent','Fully 5 ปี','percent','fully5_target','fully5_percent','Data_Vaccine','watch',80],
      ['ecd','screened','คัดกรองพัฒนาการเด็ก 9-72 เดือน','count','target_9_72m','screened','Data_ECD','primary',80],
      ['ecd','normal','เด็กพัฒนาการสมวัย','count','screened','normal','Data_ECD','watch',80],
      ['dental','dental_access_percent','ประชากรเข้าถึงบริการทันตกรรมรวมทุกสิทธิ','percent','population_total','dental_access_percent','Data_Dental','primary',80],
      ['dental','dental_service_total','รับบริการทันตกรรมรวม','count','population_total','dental_service_total','Data_Dental','watch',80],
      ['elderly','screening9_percent','ผู้สูงอายุได้รับการคัดกรอง 9 ด้าน','percent','elderly_total','screening9_percent','Data_Elderly','primary',80],
      ['elderly','wnp_percent','จัดทำ WNP ในกลุ่มเสี่ยงอย่างน้อย 1 ด้าน','percent','wnp_risk_total','wnp_percent','Data_Elderly','watch',80],
      ['elderly','careplan_percent','จัดทำ Care plan ในกลุ่มภาวะพึ่งพิง','percent','careplan_dependent_total','careplan_percent','Data_Elderly','watch',80],
      ['cancer','hpv_kits_distributed','แจกชุดตรวจ HPV','count','women_30_60_target','hpv_kits_distributed','Data_Cancer','primary',80],
      ['cancer','hpv_kits_returned','ส่งคืนชุดตรวจ HPV','count','women_30_60_target','hpv_kits_returned','Data_Cancer','primary',80],
      ['cancer','hpv_normal','ผล HPV ปกติ','count','women_30_60_target','hpv_normal','Data_Cancer','watch',80]
    ]);

  const schemas = {
    Data_NCD: ['year','month','facility_id','facility_code','facility_name','dm_screen_target','dm_screen_percent','dm_suspected','dm_confirm_percent','dm_patient_total','hba1c_percent','ht_screen_target','ht_screen_percent','ht_suspected','ht_confirm_percent','dm_ht_patient_total','ckd_screen_percent','note'],
    Data_MCH: ['year','month','facility_id','facility_code','facility_name','pregnant_new','delivered_total','anc_before_12w','anc_5_quality','postpartum_visit_1_7d','postpartum_visit_8_14d','postpartum_visit_15_42d','breastfeeding_6m','pending','note'],
    Data_Vaccine: ['year','month','facility_id','facility_code','facility_name','fully1_target','fully1_done','fully1_percent','fully1_gap','fully2_target','fully2_done','fully2_percent','fully2_gap','fully3_target','fully3_done','fully3_percent','fully3_gap','fully5_target','fully5_done','fully5_percent','fully5_gap','monthly_result_note'],
    Data_ECD: ['year','month','facility_id','facility_code','facility_name','target_9_72m','screened','normal','suspected_delay','followup_1m','referred_diagnosis','pending','note'],
    Data_Dental: ['year','month','facility_id','facility_code','facility_name','population_total','dental_access_percent','pregnant_total','pregnant_oral_percent','child_0_2_total','child_0_2_oral_percent','child_0_2_fluoride_total','child_0_2_fluoride_percent','child_3_5_total','child_3_5_oral_percent','child_3_5_fluoride_total','child_3_5_fluoride_percent','child_6_12_total','child_6_12_oral_percent','child_6_total','child_6_sealant_percent','child_0_5_total','cavity_free_percent','outreach_total','outreach_percent','dental_service_total','pending_percent','note'],
    Data_Elderly: ['year','month','facility_id','facility_code','facility_name','elderly_target','elderly_total','screening9_percent','wnp_risk_total','wnp_percent','careplan_dependent_total','careplan_percent','club_assessment_percent','club_result_percent','note'],
    Data_Cancer: ['year','month','facility_id','facility_code','facility_name','women_30_60_target','hpv_kits_distributed','hpv_kits_returned','hpv_normal','hpv_abnormal','repeat_appointment','ca_cx_diagnosed','cbe_breast_screened','pending','note']
  };

  Object.keys(schemas).forEach(function (sheetName) {
    const headers = schemas[sheetName];
    const rows = facilities.map(function (f) {
      return headers.map(function (h) {
        if (h === 'year') return Y;
        if (h === 'month') return M;
        if (h === 'facility_id') return f.id;
        if (h === 'facility_code') return f.code;
        if (h === 'facility_name') return f.name;
        if (h === 'note' || h === 'monthly_result_note') return '(รอกรอก)';
        return 0;
      });
    });
    seedContractSheet_(ss, sheetName, headers, rows);
  });

  CacheService.getScriptCache().removeAll(['v1:all::2569:7']);
  Logger.log('setupDataContractSheets เสร็จสิ้น: สร้าง/อัปเดตชีต contract รุ่นใหม่แล้ว');
}

function seedContractSheet_(ss, name, headers, rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length && sh.getLastRow() < 2) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sh.setFrozenRows(1);
}

/* ======================================================================
 * AuditLog — ติดตั้ง trigger: Triggers > Add Trigger >
 *   function: onEditAudit, event source: From spreadsheet, event type: On edit
 * ====================================================================== */

function onEditAudit(e) {
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  if (sheetName === 'AuditLog') return;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const log = ss.getSheetByName('AuditLog');
  if (!log) return;
  log.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
    (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || '(ไม่ทราบ)',
    sheetName,
    e.range.getA1Notation(),
    e.oldValue !== undefined ? e.oldValue : '',
    e.value !== undefined ? e.value : ''
  ]);
}
