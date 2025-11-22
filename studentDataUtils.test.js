const assert = require('assert');
const { describe, it } = require('node:test');
const {
    parseQueries,
    searchStudents,
    filterStudents,
    createExportPayload,
} = require('./studentDataUtils');

describe('StudentDataUtils', () => {
    const sampleData = [
        { "รหัสนักศึกษา": '123', "ชื่อ-นามสกุล": 'Alice Example', "ไปค่าย": true },
        { "รหัสนักศึกษา": '456', "ชื่อ-นามสกุล": 'Bob Sample', "ไปค่าย": false },
        { "รหัสนักศึกษา": '789', "ชื่อ-นามสกุล": 'Charlie Demo', "ไปค่าย": true },
    ];

    describe('parseQueries', () => {
        it('splits and normalizes multiple comma separated values', () => {
            assert.deepStrictEqual(parseQueries('123, 456 , Alice'), ['123', '456', 'alice']);
        });

        it('ignores empty entries', () => {
            assert.deepStrictEqual(parseQueries(' , ,'), []);
        });
    });

    describe('searchStudents', () => {
        it('returns all data when query is empty', () => {
            assert.strictEqual(searchStudents(sampleData, '').length, sampleData.length);
        });

        it('matches multiple ids or names in one search', () => {
            const result = searchStudents(sampleData, '123, 789');
            assert.deepStrictEqual(result.map((s) => s['รหัสนักศึกษา']), ['123', '789']);
        });
    });

    describe('filterStudents', () => {
        it('filters attended students', () => {
            const result = filterStudents(sampleData, 'attended');
            assert.deepStrictEqual(result.map((s) => s['รหัสนักศึกษา']), ['123', '789']);
        });

        it('filters not attended students', () => {
            const result = filterStudents(sampleData, 'not_attended');
            assert.deepStrictEqual(result.map((s) => s['รหัสนักศึกษา']), ['456']);
        });
    });

    describe('createExportPayload', () => {
        it('includes only attended rows when requested', () => {
            const payload = createExportPayload(sampleData, true);
            assert.strictEqual(payload.rows.length, 2);
            assert.strictEqual(payload.attendedCount, 2);
            assert.strictEqual(payload.notAttendedCount, 0);
            assert.deepStrictEqual(payload.rows.map((r) => r['รหัสนักศึกษา']), ['123', '789']);
        });

        it('includes all rows and summary when exporting everything', () => {
            const payload = createExportPayload(sampleData, false);
            assert.strictEqual(payload.rows.length, 3);
            assert.strictEqual(payload.attendedCount, 2);
            assert.strictEqual(payload.notAttendedCount, 1);
            assert.strictEqual(payload.summaryRow['ชื่อ-นามสกุล'], 'จำนวนที่ไปค่าย: 2');
            assert.strictEqual(payload.rows[0]['ลำดับ'], 1);
            assert.strictEqual(payload.rows[2]['ลำดับ'], 3);
        });
    });
});
