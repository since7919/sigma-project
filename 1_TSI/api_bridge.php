<?php
// CORS 설정
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Secret-Token");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. 오픈 프록시 방지 (보안 토큰 검증)
$secret_token = "sigma-secure-token-2026"; // 백엔드와 동일하게 맞춰야 하는 비밀번호
$headers = apache_request_headers();
$provided_token = isset($headers['X-Secret-Token']) ? $headers['X-Secret-Token'] : (isset($_GET['token']) ? $_GET['token'] : '');

if ($provided_token !== $secret_token) {
    http_response_code(403);
    echo "Forbidden: Invalid Secret Token.";
    exit;
}

$url = '';
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['target_url'])) {
        $url = $input['target_url'];
    }
} elseif (isset($_GET['url'])) {
    $url = $_GET['url'];
}

if (empty($url)) {
    http_response_code(400);
    echo "Error: URL parameter is missing.";
    exit;
}

// UTIC 전용 프록시로 제한
$utic_api_key = "9rKirej7S3pv112cEGe6Cotf9ybxRrvEuKXJCOU";

if (strpos($url, 'tsihub.utic.go.kr') !== false) {
    if (preg_match('/([?&])serviceKey=[^&]*/', $url)) {
        $url = preg_replace('/([?&])serviceKey=[^&]*/', '$1serviceKey=' . $utic_api_key, $url);
    } else {
        $separator = (strpos($url, '?') !== false) ? '&' : '?';
        $url .= $separator . "serviceKey=" . $utic_api_key;
    }
} else {
    http_response_code(403);
    echo "Error: Not allowed domain. This bridge is for UTIC only.";
    exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

if(curl_errno($ch)){
    http_response_code(500);
    echo 'cURL error: ' . curl_error($ch);
    curl_close($ch);
    exit;
}
curl_close($ch);

http_response_code($httpcode);
if ($content_type) {
    header("Content-Type: " . $content_type);
}

echo $response;
?>
