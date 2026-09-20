const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/data_parser.js', 'utf8');

const regex = /const cycCols = \[\], idxCols = \[\], offCols = \[\], spCols = \[\];\s*for \(let col = 1; col <= 80; col\+\+\) \{\s*const hVal = String\(getVal\(r \+ 1, col\) \|\| ""\)\.toLowerCase\(\)\.replace\(\/\\s\/g, ''\);\s*if \(hVal === "cycle" \|\| hVal === "주기"\) cycCols\.push\(col\);\s*else if \(hVal === "index" \|\| hVal === "인덱스"\) idxCols\.push\(col\);\s*else if \(hVal === "offset" \|\| hVal === "옵셋"\) offCols\.push\(col\);\s*else if \(hVal === "split" \|\| hVal === "스플릿" \|\| hVal\.includes\("split"\)\) spCols\.push\(col\);\s*\}/;

const replacement = \const cycCols = [], idxCols = [], offCols = [], spCols = [], noCols = [];
                            for (let col = 1; col <= 80; col++) {
                                const hVal = String(getVal(r + 1, col) || "").toLowerCase().replace(/\\\\s/g, '');
                                if (hVal === "cycle" || hVal === "주기") cycCols.push(col);
                                else if (hVal === "index" || hVal === "인덱스") idxCols.push(col);
                                else if (hVal === "offset" || hVal === "옵셋") offCols.push(col);
                                else if (hVal === "split" || hVal === "스플릿" || hVal.includes("split")) spCols.push(col);
                                else if (hVal === "no" || hVal === "패턴") noCols.push(col);
                            }\;

code = code.replace(regex, replacement);

const regex2 = /const cycCL = cycCols\[0\] \|\| 5, cycCR = cycCols\[1\] \|\| \(cycCols\[0\] \? cycCols\[0\] \+ 24 : 29\);\s*const offCL = offCols\[0\] \|\| 9, offCR = offCols\[1\] \|\| \(offCols\[0\] \? offCols\[0\] \+ 23 : 32\);\s*const spCL = spCols\[0\] \|\| 13, spCR = spCols\[1\] \|\| \(spCols\[0\] \? spCols\[0\] \+ 22 : 35\);/;

const replacement2 = \const cycCL = cycCols[0] || 5, cycCR = cycCols[1] || (cycCols[0] ? cycCols[0] + 24 : 29);
                            const offCL = offCols[0] || 9, offCR = offCols[1] || (offCols[0] ? offCols[0] + 23 : 32);
                            const spCL = spCols[0] || 13, spCR = spCols[1] || (spCols[0] ? spCols[0] + 22 : 35);
                            const noCL = noCols[0] || 1, noCR = noCols[1] || (noCols[0] ? noCols[0] + 25 : 26);\;

code = code.replace(regex2, replacement2);

const regex3 = /tpPlans\[k\] = \{\s*cycle: lastCycL,\s*offset: offL,\s*splitA: sAL,\s*splitB: sBL\s*\};\s*\/\/ \[우측 테이블: 패턴 9 ~ 16\] \(k = 0~7 -> pattern 9~16\)\s*const parsedCycR = parseInt\(getVal\(rA, cycCR\)\);\s*if \(\!isNaN\(parsedCycR\) && parsedCycR > 0\) lastCycR = parsedCycR;\s*const offR = parseInt\(getVal\(rA, offCR\)\) \|\| 0;\s*const splitColsR = \[\];\s*for \(let sc = spCR; sc < spCR \+ 35 && splitColsR\.length < 8; sc\+\+\) \{\s*const v = getVal\(rA, sc\);\s*if \(v \!\=\= null && v \!\=\= undefined && String\(v\)\.trim\(\) \!\=\= ''\) splitColsR\.push\(sc\);\s*\}\s*const sAR = splitColsR\.map\(sc => parseInt\(getVal\(rA, sc\)\) \|\| 0\);\s*const sBR = splitColsR\.map\(sc => parseInt\(getVal\(rB, sc\)\) \|\| 0\);\s*while \(sAR\.length < 8\) sAR\.push\(0\);\s*while \(sBR\.length < 8\) sBR\.push\(0\);\s*tpPlans\[k \+ 8\] = \{\s*cycle: lastCycR,\s*offset: offR,\s*splitA: sAR,\s*splitB: sBR\s*\};/;

const replacement3 = \const parsedNoL = parseInt(getVal(rA, noCL));
                                const pIdxL = (!isNaN(parsedNoL) && parsedNoL >= 1 && parsedNoL <= 16) ? (parsedNoL - 1) : k;
                                tpPlans[pIdxL] = {
                                    cycle: lastCycL,
                                    offset: offL,
                                    splitA: sAL,
                                    splitB: sBL
                                };

                                // [우측 테이블]
                                const parsedCycR = parseInt(getVal(rA, cycCR));
                                if (!isNaN(parsedCycR) && parsedCycR > 0) lastCycR = parsedCycR;
                                
                                const offR = parseInt(getVal(rA, offCR)) || 0;

                                const splitColsR = [];
                                for (let sc = spCR; sc < spCR + 35 && splitColsR.length < 8; sc++) {
                                    const v = getVal(rA, sc);
                                    if (v !== null && v !== undefined && String(v).trim() !== '') splitColsR.push(sc);
                                }
                                const sAR = splitColsR.map(sc => parseInt(getVal(rA, sc)) || 0);
                                const sBR = splitColsR.map(sc => parseInt(getVal(rB, sc)) || 0);
                                while (sAR.length < 8) sAR.push(0);
                                while (sBR.length < 8) sBR.push(0);

                                const parsedNoR = parseInt(getVal(rA, noCR));
                                const pIdxR = (!isNaN(parsedNoR) && parsedNoR >= 1 && parsedNoR <= 16) ? (parsedNoR - 1) : (k + 8);
                                tpPlans[pIdxR] = {
                                    cycle: lastCycR,
                                    offset: offR,
                                    splitA: sAR,
                                    splitB: sBR
                                };\;

code = code.replace(regex3, replacement3);

fs.writeFileSync('SIGMA_SIM/js/data_parser.js', code);
console.log('done parsing patch');
