const express = require('express');
const cors = require('cors');
const axios = require('axios');
const supabase = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const UTIC_API_KEY = process.env.UTIC_API_KEY;
const SEOUL_API_KEY = process.env.SEOUL_API_KEY;

// 헬스 체크 엔드포인트 (Render 절전 방지용)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Sigma Backend is running' });
});

// 1. 교차로 마스터 데이터 조회 (Supabase)
app.get('/api/intersections', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('utic_intersections')
      .select('*');
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('DB 조회 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. UTIC 실시간 신호정보 프록시 라우트
app.get('/api/proxy/utic', async (req, res) => {
  const { regionCode, itstNm } = req.query;
  
  if (!regionCode || !itstNm) {
    return res.status(400).json({ error: 'regionCode와 itstNm 파라미터가 필요합니다.' });
  }
  
  try {
    const url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?serviceKey=${UTIC_API_KEY}&regionCode=${regionCode}&itstNm=${encodeURIComponent(itstNm)}&type=json`;
    
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('UTIC API 호출 에러:', error.message);
    res.status(500).json({ error: 'UTIC API 통신 실패' });
  }
});

// 3. 서울 T-Data 실시간 신호정보 프록시 라우트
app.get('/api/proxy/seoul', async (req, res) => {
  // 실제 서울시 API 엔드포인트에 맞춰 수정 필요
  const { intersectionId } = req.query;
  
  try {
    // 임시 엔드포인트 예시
    const url = `http://t-data.seoul.go.kr/api/example?apikey=${SEOUL_API_KEY}&id=${intersectionId}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Seoul API 호출 에러:', error.message);
    res.status(500).json({ error: '서울 T-Data API 통신 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Sigma Backend Server is running on port ${PORT}`);
});
