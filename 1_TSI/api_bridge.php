<?php
// CORS 설정
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

$url = '';
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['target_url'])) {
        $url = $input['target_url'];
    }
} elseif (isset($_GET['safeurl'])) {
    $url = str_replace(array('_HTTP_', '_HTTPS_'), array('http://', 'https://'), $_GET['safeurl']);
} elseif (isset($_GET['b64url'])) {
    $url = base64_decode($_GET['b64url']);
} elseif (isset($_GET['url'])) {
    $url = $_GET['url'];
}

if (empty($url)) {
    http_response_code(400);
    echo "Error: URL parameter is missing.";
    exit;
}

$seoul_api_key = "a6a8e58e-7215-4025-b453-2d33cdd09eb2";
$utic_api_key = "9rKirej7S3pv112cEGe6Cotf9ybxRrvEuKXJCOU";

if (strpos($url, 't-data.seoul.go.kr') !== false) {
    $separator = (strpos($url, '?') !== false) ? '&' : '?';
    $url .= $separator . "apikey=" . $seoul_api_key;
} elseif (strpos($url, 'tsihub.utic.go.kr') !== false) {
    if (preg_match('/([?&])serviceKey=[^&]*/', $url)) {
        $url = preg_replace('/([?&])serviceKey=[^&]*/', '$1serviceKey=' . $utic_api_key, $url);
    } else {
        $separator = (strpos($url, '?') !== false) ? '&' : '?';
        $url .= $separator . "serviceKey=" . $utic_api_key;
    }
} else {
    http_response_code(403);
    echo "Error: Not allowed domain.";
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
