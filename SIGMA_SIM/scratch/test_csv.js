fetch('https://sigma-project-245n.onrender.com/api/sim/data?file=db_L01_stats.csv')
  .then(r => r.text())
  .then(t => {
      const lines = t.split('\n').filter(l => l.trim());
      const h = lines[0].split(',').map(s => s.replace(/"/g,''));
      const idx = h.indexOf('leftProt');
      let c = 0;
      for(let i=1; i<lines.length; i++) {
          const v = lines[i].split(',').map(s => s.replace(/"/g,''));
          if(v[idx] && v[idx].length > 0) c++;
      }
      console.log('Count:', c);
  });
