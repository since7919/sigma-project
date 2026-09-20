const axios = require('axios');
axios.get('https://sigma-project-245n.onrender.com/realtime/').then(res => console.log(res.data.substring(0, 800)));
