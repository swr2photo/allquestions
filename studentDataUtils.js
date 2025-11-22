(function (global) {
    function parseQueries(queryString) {
        if (!queryString) return [];
        return queryString
            .toLowerCase()
            .split(',')
            .map((q) => q.trim())
            .filter((q) => q.length > 0);
    }

    function searchStudents(data, queryString) {
        const queries = parseQueries(queryString);
        if (queries.length === 0) {
            return data;
        }

        return data.filter((student) => {
            const id = (student["รหัสนักศึกษา"] || '').toString().toLowerCase();
            const name = (student["ชื่อ-นามสกุล"] || '').toLowerCase();
            return queries.some((q) => id.includes(q) || name.includes(q));
        });
    }

    function filterStudents(data, status) {
        if (status === 'attended') {
            return data.filter((student) => student["ไปค่าย"]);
        }
        if (status === 'not_attended') {
            return data.filter((student) => !student["ไปค่าย"]);
        }
        return data;
    }

    function createExportPayload(data, onlyAttended) {
        const targetData = onlyAttended ? data.filter((s) => s["ไปค่าย"]) : data.slice();
        const rows = targetData.map((student, index) => ({
            ...student,
            "ลำดับ": index + 1,
        }));
        const attendedCount = targetData.filter((s) => s["ไปค่าย"]).length;
        const notAttendedCount = targetData.length - attendedCount;
        const summaryRow = {
            "ลำดับ": "สรุป",
            "รหัสนักศึกษา": "",
            "ชื่อ-นามสกุล": `จำนวนที่ไปค่าย: ${attendedCount}`,
            "ไปค่าย": "",
        };

        return {
            rows,
            summaryRow,
            attendedCount,
            notAttendedCount,
        };
    }

    const exported = {
        parseQueries,
        searchStudents,
        filterStudents,
        createExportPayload,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    }
    global.StudentDataUtils = exported;
})(typeof window !== 'undefined' ? window : globalThis);
