"use strict"
self.onmessage = (e)=> {

    console.log(e.data.message);
    let time = 1000;
    let timer = null;

    callEvpServiceList();
    function callEvpServiceList() {
        let start = new Date().getTime();

        if (timer) clearTimeout(timer);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/getEvpsInfo.do', true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.responseType = 'text';
        xhr.send()  //요청 전송
        xhr.onload = () => {
            //정상 코드 200
            if(xhr.status === 200) {
                const res = xhr.response;
                if (res) {
                    postMessage(res);
                }
                let end  = new Date().getTime();
                let between  = end - start;
                if (between >= 1000) {
                    between = 1000;
                }

                timer = setTimeout(()=>{
                    callEvpServiceList();
                }, time - between);
                // postMessage(res);
            } else {
                //에러발생
                console.error(xhr.status, xhr.statusText); //응답상태와 응답 메시지 출력
            }
        }

    }
}