import XLSX from 'xlsx';
import fs from 'fs';

// Excel 파일 읽기
const workbook = XLSX.readFile('오로지 손익집계_초안_ver1-1.xlsx');

console.log('='.repeat(60));
console.log('Excel 파일 구조 분석: 오로지 손익집계_초안_ver1-1.xlsx');
console.log('='.repeat(60));
console.log('시트 목록:', workbook.SheetNames);

// 각 시트 분석
workbook.SheetNames.forEach(sheetName => {
    console.log('\n' + '='.repeat(60));
    console.log(`시트: ${sheetName}`);
    console.log('='.repeat(60));

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`총 행 수: ${data.length}`);
    console.log(`총 열 수: ${Math.max(...data.map(row => row.length))}`);

    // 첫 30행 출력
    console.log('\n[처음 30행 데이터]');
    data.slice(0, 30).forEach((row, index) => {
        const rowData = row.slice(0, 15); // 처음 15열만
        console.log(`Row ${index + 1}:`, rowData.map(cell =>
            cell === undefined ? '' :
            typeof cell === 'number' ? cell.toLocaleString() :
            String(cell).substring(0, 30)
        ));
    });

    // 계산식 찾기
    console.log('\n[수식이 포함된 셀]');
    Object.keys(sheet).forEach(cell => {
        if (sheet[cell].f) { // f는 formula를 의미
            console.log(`${cell}: ${sheet[cell].f}`);
        }
    });
});

// 손익계산서 구조 분석
console.log('\n' + '='.repeat(60));
console.log('손익계산서 구조 분석');
console.log('='.repeat(60));

const mainSheet = workbook.Sheets['24년 오로지 손익'];
const mainData = XLSX.utils.sheet_to_json(mainSheet, { header: 1 });

// 주요 항목 찾기
mainData.forEach((row, index) => {
    const firstCell = row[0];
    if (firstCell && typeof firstCell === 'string') {
        const keywords = ['매출', '원가', '이익', '비용', '판관비', '영업', '당기', '세전', '세후'];
        if (keywords.some(keyword => firstCell.includes(keyword))) {
            console.log(`Row ${index + 1}: ${firstCell} =>`, row.slice(1, 5));
        }
    }
});