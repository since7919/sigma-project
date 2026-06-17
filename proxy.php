<?php
// proxy.php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$url = $_GET['url'] ?? '';
if (!$url) {
    http_response_code(400);
    echo json_encode(['error' => 'No URL provided']);
    exit;
}

// 1. SSRF 방지를 위해 프록시 허용 도메인 검증
$allowedHosts = ['tsihub.utic.go.kr', 't-data.seoul.go.kr'];
$parsedUrl = parse_url($url);
$host = $parsedUrl['host'] ?? '';

if (!in_array($host, $allowedHosts)) {
    http_response_code(400);
    echo json_encode(['error' => '허용되지 않은 외부 URL 요청입니다.']);
    exit;
}

// 2. config.php 또는 환경변수에서 비밀 토큰 로드
$expectedToken = null;
if (file_exists(__DIR__ . '/config.php')) {
    $config = include(__DIR__ . '/config.php');
    $expectedToken = $config['BRIDGE_SECRET_KEY'] ?? null;
}
if (!$expectedToken) {
    $expectedToken = getenv('BRIDGE_SECRET_KEY') ?: ($_ENV['BRIDGE_SECRET_KEY'] ?? null);
}

// 토큰이 설정되지 않았거나 일치하지 않으면 접근 거부
$secretToken = $_SERVER['HTTP_X_SECRET_TOKEN'] ?? '';
if (!$expectedToken || $secretToken !== $expectedToken) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
?>