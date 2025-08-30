//let fixedSimulationDuration = 900; // 固定模擬時間區間，單位秒，預設300秒
let customPath = null; // 儲存使用者定義的路徑

const GRID_SPACING_X = 100; // 設計區水平間距（像素）
const GRID_SPACING_Y = 100; // 設計區垂直間距（像素）
let GRID_ROWS = 20; // 假設 8 行，可根據實際需求調整
let GRID_COLS = 20; // 假設 8 列，可根據實際需求調整
const CIRCLE_RADIUS = 15; // 圓點半徑，與原始一致
const METER_TO_PIXEL = 1;//可不要，但為了相容，暫時保留，會影響統計

function gcd(a, b) {
    a = Math.abs(Math.round(a)); // Ensure positive integers
    b = Math.abs(Math.round(b)); // Ensure positive integers
    if (b === 0) return a;
    return gcd(b, a % b);
}

function lcm(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    if (a === 0 || b === 0) return 0;
    // Handle potential floating point issues by working with integers if possible
    // or ensure inputs to gcd are integers.
    let result = Math.abs(a * b) / gcd(a, b);
    return Math.round(result); // Round to nearest integer for cycle times
}

function calculateLcmOfSelectedCycleTimes() {
    const selectedCircles = gridCircles.filter(c => c.selected && !c.spawnEnabled); // Consider only selected, non-spawn intersections

    if (selectedCircles.length === 0) {
        document.getElementById("lcmDurationValue").textContent = "N/A (無適用路口)";
        return 900; // Default if no relevant circles are selected
    }

    const cycleTimes = selectedCircles.map(circle => {
        const cycle = getCycleLength(circle); // Assumes getCycleLength returns a number
        return Math.round(cycle); // Ensure cycle times are integers for LCM
    }).filter(ct => ct > 0); // Filter out zero or negative cycle times

    if (cycleTimes.length === 0) {
        document.getElementById("lcmDurationValue").textContent = "N/A (無有效週期)";
        return 900; // Default if no valid cycle times
    }

    let resultLcm = cycleTimes[0];
    for (let i = 1; i < cycleTimes.length; i++) {
        resultLcm = lcm(resultLcm, cycleTimes[i]);
        if (resultLcm > 10000) { // Intermediate cap to prevent excessively large LCMs during calculation
            document.getElementById("lcmDurationValue").textContent = ">1000 (已達上限)";
            return 1000;
        }
    }
    const finalLcm = Math.min(resultLcm, 1000); // Final value capped at 1000
    document.getElementById("lcmDurationValue").textContent = finalLcm;
    return finalLcm;
}

function updateSimulationDurationUI(duration) {
    const inputEl = document.getElementById("simulationDurationInput");
    if (inputEl) inputEl.value = Math.round(duration);
    calculateLcmOfSelectedCycleTimes(); // Keep suggested LCM updated
}

function applyNewSimulationDuration(newDuration, fromUserInput = false) {
    let validatedDuration = Math.round(Number(newDuration)); // Ensure integer

    if (isNaN(validatedDuration) || validatedDuration <= 0) {
        console.warn("無效的模擬時間輸入，將使用當前值或預設值。");
        validatedDuration = calculateLcmOfSelectedCycleTimes(); // Fallback to LCM
    }

    validatedDuration = Math.min(Math.max(10, validatedDuration), 1000); // Min 10s, Max 1000s

    if (fixedSimulationDuration !== validatedDuration) {
        fixedSimulationDuration = validatedDuration;
        console.log(`模擬時間區間已更新為: ${fixedSimulationDuration} 秒`);

        // Simulation parameters that depend on fixedSimulationDuration might need updates
        if (simulationStarted) { // Only if simulation has been run at least once
            precomputeTrafficLightStates();
            updateSpacetimeOffscreen(); // This will use the new fixedSimulationDuration
            renderSpawnDataDisplay(); // To recalculate probabilities etc.
        }
    }
    // Always update the UI to reflect the actual applied (and validated) value
    document.getElementById("simulationDurationInput").value = fixedSimulationDuration;

    // If the update was from user input, we don't need to re-calculate LCM for display immediately,
    // but if it was from reset, the LCM is already displayed.
    if (!fromUserInput) {
         calculateLcmOfSelectedCycleTimes(); // Ensure suggestion is current
    }
}

// (在 DOMContentLoaded 或類似的初始化函數中)
function setupSimulationDurationControls() {
    const initialLcmDuration = calculateLcmOfSelectedCycleTimes();
    fixedSimulationDuration = initialLcmDuration; // Set initial global value
    updateSimulationDurationUI(fixedSimulationDuration); // Update input field

    document.getElementById("applySimDurationBtn").addEventListener("click", () => {
        const userInputDuration = document.getElementById("simulationDurationInput").value;
        applyNewSimulationDuration(userInputDuration, true); // true indicates from user input
        alert(`模擬時間區間已設定為 ${fixedSimulationDuration} 秒。`);
    });

    document.getElementById("resetSimDurationBtn").addEventListener("click", () => {
        const lcmDuration = parseFloat(document.getElementById("lcmDurationValue").textContent);
        if (!isNaN(lcmDuration)) {
             applyNewSimulationDuration(lcmDuration);
        } else {
            // Fallback if LCM parsing failed
            applyNewSimulationDuration(calculateLcmOfSelectedCycleTimes());
        }
        alert(`模擬時間區間已重設為建議預設值 ${fixedSimulationDuration} 秒。`);
    });

    // Optional: Update suggested LCM when simulationDurationInput changes,
    // or rely on other events (like circle selection) to update it.
    // document.getElementById("simulationDurationInput").addEventListener("input", () => {
    //     calculateLcmOfSelectedCycleTimes(); // Keep suggestion fresh
    // });
}


// 禁用縮放相關事件

function resetZoom() {
  const zoomFactor = 0.8;
  document.body.style.zoom = zoomFactor; // 縮放到 80%

}

// 初始設置
resetZoom();  

function updateCycleTimeDisplay(circle) {
  const cycleTime = circle.phases.reduce((sum, phase) => sum + phase.greenTime + phase.redTime, 0);
  document.getElementById("cycleTimeDisplay").textContent = `${cycleTime} 秒`;
}


// (在 DOMContentLoaded 或類似的初始化函數中)
function initializeIdmPanel() {
    document.getElementById("idm_v0").value = (IDM_PARAMS.v0 * 3.6).toFixed(1); // m/s to km/h
    document.getElementById("idm_T").value = IDM_PARAMS.T.toFixed(1);
    document.getElementById("idm_a").value = IDM_PARAMS.a.toFixed(1);
    document.getElementById("idm_b").value = IDM_PARAMS.b.toFixed(1);
    document.getElementById("idm_s0").value = IDM_PARAMS.s0.toFixed(1);
}
// 在網頁載入時初始化匯入/匯出介面
document.addEventListener("DOMContentLoaded", () => {
  // --- 原有的設定面板、IDM 面板等初始化代碼 ---
  const settingsPanel = document.getElementById("settingsPanel");
  const titleBar = document.getElementById("titleBar");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const minimizedIcon = document.getElementById("minimizedIcon");
  const iconWrapper = minimizedIcon.querySelector(".icon-wrapper");
  const panelContent = document.getElementById("panelContent");
  let isDragging = false;
  let currentX = window.innerWidth - settingsPanel.offsetWidth - 20;
  let currentY = 100;
  let initialX, initialY;

  settingsPanel.style.left = `${currentX}px`;
  settingsPanel.style.top = `${currentY}px`;
  settingsPanel.style.display = "none";
  minimizedIcon.style.display = "block";
  minimizedIcon.style.opacity = "1";

  titleBar.addEventListener("mousedown", (e) => {
    if (e.target !== minimizeBtn) {
      initialX = e.clientX - currentX;
      initialY = e.clientY - currentY;
      isDragging = true;
    }
  });

  document.getElementById("intersectionName").addEventListener("input", function() {
    if(selectedCircle) selectedCircle.intersectionName = this.value;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      settingsPanel.style.left = `${currentX}px`;
      settingsPanel.style.top = `${currentY}px`;
      settingsPanel.style.right = "auto";
      gcurrentX = currentX;
      gcurrentY = currentY;
    }
  });

  document.addEventListener("mouseup", () => { isDragging = false; });
  minimizeBtn.addEventListener("click", () => { minimizeSettingsPanel(settingsPanel, minimizedIcon, currentX, currentY); });
  iconWrapper.addEventListener("click", () => { restoreSettingsPanel(settingsPanel, minimizedIcon, panelContent, currentX, currentY); });
  
  window.addEventListener("resize", () => {
    if (settingsPanel.style.display !== "none") {
      currentX = Math.min(currentX, window.innerWidth - settingsPanel.offsetWidth - 20);
      currentY = Math.min(currentY, window.innerHeight - settingsPanel.offsetHeight - 20);
      settingsPanel.style.left = `${currentX}px`;
      settingsPanel.style.top = `${currentY}px`;
    }
  });

  initializeIdmPanel();
  setupSimulationDurationControls();

  if (document.getElementById("applyAlgoParamsBtn")) {
    initializeAlgoParamsUI();
  }

  document.getElementById("applyIdmParamsBtn").addEventListener("click", () => {
    const new_v0_kmh = parseFloat(document.getElementById("idm_v0").value);
    IDM_PARAMS.v0 = new_v0_kmh / 3.6;
    IDM_PARAMS.T = parseFloat(document.getElementById("idm_T").value);
    IDM_PARAMS.a = parseFloat(document.getElementById("idm_a").value);
    IDM_PARAMS.b = parseFloat(document.getElementById("idm_b").value);
    IDM_PARAMS.s0 = parseFloat(document.getElementById("idm_s0").value);
    document.getElementById("vehicleSpeedInput").value = new_v0_kmh.toFixed(0);
    console.log("IDM 參數已更新:", IDM_PARAMS);
    alert("IDM 參數已套用！");
  });

  const vehicleSpeedInput = document.getElementById("vehicleSpeedInput");
  const idm_v0_input = document.getElementById("idm_v0");
  vehicleSpeedInput.addEventListener("change", function() {
    const speedKmH = parseFloat(this.value);
    idm_v0_input.value = speedKmH.toFixed(1);
  });
  idm_v0_input.addEventListener("change", function() {
    const speedKmH = parseFloat(this.value);
    vehicleSpeedInput.value = speedKmH.toFixed(0);
    vehicleSpeedInput.dispatchEvent(new Event('change'));
  });
  
  // 綁定路徑選擇器的事件
  document.getElementById("pathStartPointSelector").addEventListener("change", handlePathSelectionChange);
  document.getElementById("pathEndPointSelector").addEventListener("change", handlePathSelectionChange);

  // 綁定主選擇器的事件監聽器
  const mainSelector = document.getElementById("spawnPointSelector");
  mainSelector.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value === 'custom_path') {
      selectedSpawnIndex = 'custom_path';
    } else {
      selectedSpawnIndex = parseInt(value, 10);
    }
    
    if ( (typeof selectedSpawnIndex === 'string' && selectedSpawnIndex === 'custom_path') || !isNaN(selectedSpawnIndex) ) {
        precomputeTrafficLightStates();
        updateSpacetimeOffscreen();
    } else {
        console.error("無效的 selectedSpawnIndex:", selectedSpawnIndex);
    }
  });

  // 綁定畫布大小調整事件
  setCanvasSize();
  window.addEventListener("resize", setCanvasSize);

  // 【核心修正】替換整個 Tooltip 事件監聽器
  const stCanvas = document.getElementById("spacetimeCanvas");
  const tooltip = document.getElementById("spacetimeTooltip");
  if (!stCanvas || !tooltip) {
    console.error("Spacetime canvas or tooltip element not found!");
    return;
  }
  
  stCanvas.addEventListener("mousemove", function(e) {
    const zoomFactor = parseFloat(document.body.style.zoom) || 1;
    
    let maxDistance;

    // 根據當前模式（路徑或非路徑）計算 maxDistance
    if (selectedSpawnIndex === 'custom_path' && customPath && customPath.length > 0) {
        maxDistance = customPath.reduce((sum, seg) => sum + seg.distanceToNext, 0);
    } else if (typeof selectedSpawnIndex === 'number' && spawnPointsList[selectedSpawnIndex]) {
        const selectedSpawn = spawnPointsList[selectedSpawnIndex];
        const roads = continuousRoadsBySpawn[selectedSpawn.id];
        if (!roads || roads.length === 0) {
            tooltip.style.display = "none";
            return;
        }
        maxDistance = roads.reduce((sum, road) => sum + road.distance, 0);
    } else {
        // 如果沒有有效的路徑或生成點，則隱藏 tooltip 並退出
        tooltip.style.display = "none";
        return;
    }

    // 後續的計算邏輯現在可以安全執行，因為 maxDistance 已經被正確賦值
    const maxTime = fixedSimulationDuration / timeScale;
    const timeScaleFactor = stCanvas.width / maxTime;
    const margin = 15;
    const drawableHeight = stCanvas.height - 2 * margin;
    const distanceScale = maxDistance > 0 ? drawableHeight / maxDistance : 0;
    const rect = stCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoomFactor;
    const mouseY = (e.clientY - rect.top) / zoomFactor;
    const timeInSeconds = (mouseX / timeScaleFactor) * timeScale;
    const distanceFromOrigin = (stCanvas.height - margin - mouseY) / distanceScale;

    // 檢查游標是否在圖表有效範圍內
    if (distanceFromOrigin >= 0 && distanceFromOrigin <= maxDistance && timeInSeconds >= 0 && timeInSeconds <= fixedSimulationDuration) {
      tooltip.innerHTML = `(${timeInSeconds.toFixed(1)} 秒, ${distanceFromOrigin.toFixed(1)} 公尺)`;
      tooltip.style.display = 'block';
      const logicalX = e.pageX / zoomFactor;
      const logicalY = e.pageY / zoomFactor;
      tooltip.style.left = (logicalX + 15) + 'px';
      tooltip.style.top = (logicalY + 15) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });

  stCanvas.addEventListener("mouseout", function() {
    tooltip.style.display = "none";
  });
});
let gcurrentX, gcurrentY


// 修改後的 getDirectionRatios 函數，增加診斷輸出
function getDirectionRatios(spawnProbabilities) {
  const directionPairs = [['N', 'S'], ['E', 'W'], ['NE', 'SW'], ['SE', 'NW']];
  const spawnMap = new Map();
  const ratios = {};

  spawnProbabilities.forEach(spawn => {
    const spawnIndex = spawn.spawnIndex - 1;
    if (spawnIndex >= spawnPointsList.length) {
      console.warn(`spawnIndex ${spawnIndex} exceeds spawnPointsList range`);
      return;
    }
    const spawnPoint = spawnPointsList[spawnIndex];
    const direction = spawnPoint.intersection.spawnPoint.direction;
    const pathId = spawnPoint.id;
    if (!spawnMap.has(pathId)) {
      spawnMap.set(pathId, {});
    }
    spawnMap.get(pathId)[direction] = parseFloat(spawn.probability) || 0;
  });

  spawnMap.forEach((directions, pathId) => {
    directionPairs.forEach(([dir1, dir2]) => {
      const prob1 = directions[dir1] || 0;
      const prob2 = directions[dir2] || 0;
      if (prob1 > 0 && prob2 > 0) {
        const ratio = prob1 / prob2;
        ratios[`${pathId}_${dir1}-${dir2}`] = ratio.toFixed(2);
      }
    });
  });

  return ratios;
}

// 在現有變數定義之後添加
function getCycleLength(circle) {
  // 計算路口週期：所有時相的綠燈時間 + 全紅時間總和
  return circle.phases.reduce((sum, phase) => sum + phase.greenTime + phase.redTime, 0);
}
  
function renderSpawnDataDisplay() {
  const container = document.getElementById("spawnDataContent");
  if (!container) return;

  // 檢查是否有生成點數據
  if (spawnPointsList.length === 0) {
    container.innerHTML = "<p>尚無生成點數據</p>";
    return;
  }

  // 檢查交通燈狀態是否已初始化
  if (Object.keys(trafficLightStates).length === 0) {
    container.innerHTML = "<p>交通燈狀態尚未初始化，請先開始模擬或更新路網</p>";
    return;
  }

  // 清空容器並重新渲染
  container.innerHTML = "";

  spawnPointsList.forEach((spawn, spawnIndex) => {
    const spawnDivId = `spawn_${spawnIndex}`;
    let spawnDiv = document.getElementById(spawnDivId);

    // 如果 spawnDiv 不存在，則創建
    if (!spawnDiv) {
      spawnDiv = document.createElement("div");
      spawnDiv.id = spawnDivId;
      spawnDiv.className = "spawn-section";
      spawnDiv.style.marginBottom = "20px";
      container.appendChild(spawnDiv);
    }

    // 生成點標題
    const spawnName = spawn.intersection.spawnPoint.spawnName.trim();
    const spawnDirection = spawn.intersection.spawnPoint.direction;
    //const spawnTitle = spawnName ? spawnName : `(${spawn.intersection.position.x.toFixed(0)}, ${spawn.intersection.position.y.toFixed(0)})`;
	const intersectionName = spawn.intersection.intersectionName?.trim();
	const spawnTitle = intersectionName
	  ? intersectionName
	  : `(${spawn.intersection.row},${spawn.intersection.col})`;
	spawnDiv.innerHTML = `<h4>第${spawnIndex + 1}生成點: ${spawnTitle} - 方向: ${spawnDirection}</h4>`;
    // 計算通過機率
    const prevSelectedSpawnIndex = selectedSpawnIndex;
    selectedSpawnIndex = spawnIndex;
    const greenWaveData = computeGreenWavePaths();
    selectedSpawnIndex = prevSelectedSpawnIndex;

    const probability = fixedSimulationDuration && timeScale && greenWaveData.totalGreenWaveTime !== undefined
      ? ((greenWaveData.totalGreenWaveTime / (fixedSimulationDuration / timeScale)) * 100).toFixed(2) + "%"
      : "未模擬";

    // 顯示通過機率
    const probDiv = document.createElement("div");
    probDiv.style.padding = "5px";
    probDiv.innerHTML = `通過機率: ${probability}`;
    spawnDiv.appendChild(probDiv);
  });
}
  
let greenWaveSpeed = 50 * (1000 / 3600); // 40 km/h 轉為 m/s = 11.11 m/s//10; // 綠波速度，單位 m/s，預設 10 m/s
let trafficLightStates = {}; // 儲存每個路口的燈號狀態
let simulationStarted = false;
let mouseX = -1, mouseY = -1; // 儲存滑鼠座標
let spawnPointsList = []; // 所有生成點的清單
let selectedSpawnIndex = 0; // 使用者選擇的生成點索引
let continuousRoadsBySpawn = {}; // 每個生成點的連續道路


const designCanvas = document.getElementById("designCanvas");
const dCtx = designCanvas.getContext("2d");
const designWidth = designCanvas.width;
const designHeight = designCanvas.height;
const marginX = 50, marginY = 50;
const cellWidth = (designWidth - 2 * marginX) / (GRID_COLS - 1);
const cellHeight = (designHeight - 2 * marginY) / (GRID_ROWS - 1);

function computeGreenWavePaths() {
  let pathData, intersectionDistances = [], maxDistance;

  // --- 1. 數據準備 (邏輯不變) ---
  if (selectedSpawnIndex === 'custom_path' && customPath) {
      pathData = customPath;
  } else if (typeof selectedSpawnIndex === 'number' && spawnPointsList[selectedSpawnIndex]) {
      const selectedSpawn = spawnPointsList[selectedSpawnIndex];
      const roads = continuousRoadsBySpawn[selectedSpawn.id];
      if (!roads || roads.length === 0) return { paths: [], maxGreenWaveTime: 0, totalGreenWaveTime: 0, greenWaveString: "", maxGreenCount: 0 };
      
      pathData = [];
      roads.forEach((road, index) => {
          const startIntersect = simIntersections.find(inter =>
              Math.abs(inter.position.x - road.start.x) < 5 &&
              Math.abs(inter.position.y - road.start.y) < 5
          );
          if (startIntersect) {
              pathData.push({
                  intersection: startIntersect,
                  movement: selectedSpawn.intersection.spawnPoint.direction,
                  distanceToNext: road.distance
              });
          }
           if (index === roads.length - 1) {
             const endIntersect = simIntersections.find(inter =>
                Math.abs(inter.position.x - road.end.x) < 5 &&
                Math.abs(inter.position.y - road.end.y) < 5
            );
            if(endIntersect) {
                 pathData.push({
                    intersection: endIntersect,
                    movement: selectedSpawn.intersection.spawnPoint.direction,
                    distanceToNext: 0
                });
            }
        }
      });
  } else {
      return { paths: [], maxGreenWaveTime: 0, totalGreenWaveTime: 0, greenWaveString: "", maxGreenCount: 0 };
  }
  
  if (!pathData || pathData.length === 0) return { paths: [], maxGreenWaveTime: 0, totalGreenWaveTime: 0, greenWaveString: "", maxGreenCount: 0 };

  // --- 2. 建立 intersectionDistances ---
  let cumulativeDistance = 0;
  pathData.forEach(segment => {
    // 【核心修正】與 updateSpacetimeOffscreen 保持一致，手動組合正確的 intersectId
    const intersectId = segment.intersection.id || `intersect_${segment.intersection.row}_${segment.intersection.col}`;
    intersectionDistances.push({
      id: intersectId,
      distance: cumulativeDistance,
      movement: segment.movement 
    });
    cumulativeDistance += segment.distanceToNext;
  });
  maxDistance = cumulativeDistance;
  
  // --- 3. 綠波計算 (邏輯不變) ---
  const maxTime = fixedSimulationDuration;
  const step = 0.1;
  let greenWavePaths = [];
  let maxGreenWaveTime = 0;
  let totalGreenWaveTime = 0;
  let timeSteps = [];
  let maxGreenCount = 0;
  let currentGreenCount = 0;

  if (intersectionDistances.length === 0) {
      return { paths: [], maxGreenWaveTime: 0, totalGreenWaveTime: 0, greenWaveString: "", maxGreenCount: 0 };
  }

  let currentTime = 0;
  while (currentTime < maxTime) {
    let allGreen = true;
    let startRed = false;

    for (let j = 0; j < intersectionDistances.length; j++) {
        const { id: intersectId, distance, movement } = intersectionDistances[j];
        
        if (movement === 'END') continue;

        const arrivalTime = currentTime + distance / greenWaveSpeed;
        if (arrivalTime > maxTime) {
            allGreen = false;
            break;
        }

        const states = trafficLightStates[intersectId] || [];
        if (states.length === 0) {
            allGreen = false;
            break;
        }
        
        let lightState = 'red';
        for (let k = 0; k < states.length - 1; k++) {
            if (arrivalTime >= states[k].time && arrivalTime < states[k + 1].time) {
                if (states[k].state[movement] === 'green') {
                    lightState = 'green';
                }
                break;
            }
        }
        
        // 檢查最後一個時間段的狀態
        if (lightState === 'red' && states.length > 0 && arrivalTime >= states[states.length - 1].time) {
             if (states[states.length - 1].state[movement] === 'green') {
                lightState = 'green';
            }
        }


        if (lightState !== 'green') {
            allGreen = false;
            if (j === 0) {
                startRed = true;
            }
            break;
        }
    }

    let state;
    if (startRed) {
        state = "r";
        currentGreenCount = 0;
    } else if (allGreen) {
        state = "g";
        currentGreenCount++;
        maxGreenCount = Math.max(maxGreenCount, currentGreenCount);
        if (!greenWavePaths.length || greenWavePaths[greenWavePaths.length - 1].startTime !== currentTime - step) {
            greenWavePaths.push({
                startTime: currentTime,
                endDistance: maxDistance
            });
        }
        totalGreenWaveTime += step;
        maxGreenWaveTime = Math.max(maxGreenWaveTime, currentGreenCount * step);
    } else {
        state = "n";
        currentGreenCount = 0;
    }

    timeSteps.push({ time: currentTime, state: state });
    currentTime += step;
  }

  timeSteps.sort((a, b) => a.time - b.time);
  const greenWaveString = timeSteps.map(step => step.state).join("");

  return { paths: greenWavePaths, maxGreenWaveTime, totalGreenWaveTime, greenWaveString, maxGreenCount };
}

function precomputeTrafficLightStates() {
  trafficLightStates = {};
  const maxTime = fixedSimulationDuration;

  simIntersections.forEach(intersect => {
    if (!intersect.id) intersect.id = `intersect_${intersect.position.x}_${intersect.position.y}`;
    trafficLightStates[intersect.id] = [];

    // 確保路口週期大於0，避免無限迴圈
    const cycle = intersect.phases.reduce((sum, p) => sum + p.greenTime + p.redTime, 0);
    if (cycle <= 0) {
      console.warn(`Intersection ${intersect.id} has a cycle time of 0. Skipping precomputation.`);
      return; 
    }

    let currentTime = 0;
    const timeStep = 0.2;

    while (currentTime <= maxTime) {
      let elapsedTime = (currentTime - intersect.offset) % cycle;
      if (elapsedTime < 0) elapsedTime += cycle;

      let phaseTime = 0;
      // 初始化所有方向為紅燈
      let lightStatus = { 
          N: 'red', S: 'red', E: 'red', W: 'red', 
          NE: 'red', SW: 'red', SE: 'red', NW: 'red'
      };
      // 【新增】將左轉和右轉方向也加入到 lightStatus 中並初始化為紅燈
      ['N', 'S', 'E', 'W', 'NE', 'SW', 'SE', 'NW'].forEach(dir => {
          lightStatus[dir + 'L'] = 'red';
          lightStatus[dir + 'R'] = 'red';
      });

      let foundPhase = false;

      for (let i = 0; i < intersect.phases.length; i++) {
        const phase = intersect.phases[i];
        const phaseDuration = phase.greenTime + phase.redTime;

        if (elapsedTime >= phaseTime && elapsedTime < phaseTime + phaseDuration) {
          const inGreen = elapsedTime < phaseTime + phase.greenTime;
          
          if (inGreen) {
            // 【核心修正】不僅設置主方向，還要設置左轉和右轉方向
            // 1. 設置主方向綠燈
            (phase.activeDirections || []).forEach(dir => {
              lightStatus[dir] = 'green';
            });
            // 2. 設置左轉方向綠燈
            (phase.leftTurnDirections || []).forEach(dir => {
              lightStatus[dir] = 'green';
            });
            // 3. 設置右轉方向綠燈
            (phase.rightTurnDirections || []).forEach(dir => {
              lightStatus[dir] = 'green';
            });
          }
          // "黃燈+全紅"期間的邏輯保持不變（通常轉向燈不會有綠燈延續）
          else {
            const nextPhaseIndex = (i + 1) % intersect.phases.length;
            const nextPhase = intersect.phases[nextPhaseIndex];
            (phase.activeDirections || []).forEach(dir => {
              if ((nextPhase.activeDirections || []).includes(dir)) {
                lightStatus[dir] = 'green';
              }
            });
          }
          foundPhase = true;
          break;
        }
        phaseTime += phaseDuration;
      }
      
      // 如果找不到對應時相（通常不會發生），確保所有燈號為紅
      if (!foundPhase) {
          Object.keys(lightStatus).forEach(key => lightStatus[key] = 'red');
      }

      trafficLightStates[intersect.id].push({
        time: currentTime,
        state: { ...lightStatus }
      });

      currentTime += timeStep;
    }

    // 確保最後一個時間點的狀態被記錄
    const lastStateEntry = trafficLightStates[intersect.id][trafficLightStates[intersect.id].length - 1];
    if (lastStateEntry && lastStateEntry.time < maxTime) {
      trafficLightStates[intersect.id].push({
        time: maxTime,
        state: { ...lastStateEntry.state }
      });
    }
  });
}
let gridCircles = [];
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    gridCircles.push({
      row: r, col: c,
      x: marginX + c * cellWidth,
      y: marginY + r * cellHeight,
      selected: false,
      phases: [
        { activeDirections: ['N', 'S'], greenTime: 10, redTime: 1 },
        { activeDirections: ['E', 'W'], greenTime: 10, redTime: 1 }
      ],
      offset: 0,
      spawnEnabled: false,
      spawnFrequency: 5,
      spawnDirection: "E",
      spawnName: "",
      locked: false,
      isMaster: false,
      masterName: '',
      refMaster: null,
      intersectionName: "" // 新增：路口名稱，預設為空字串
    });
  }
}
	
let roadDistances = {};
let selectedCircle = null;

// 在全局範圍內定義 selector 並綁定事件（只需一次）
const selector = document.getElementById("spawnPointSelector");
selector.addEventListener("change", (e) => {
  selectedSpawnIndex = parseInt(e.target.value);
  precomputeTrafficLightStates();
  updateSpacetimeOffscreen();
});

function updateSpawnPointSelector() {
  const selector = document.getElementById("spawnPointSelector");
  const currentValue = selector.value; // 保存當前選擇
  selector.innerHTML = ""; // 清空現有選項

  spawnPointsList.forEach((sp, index) => {
    const option = document.createElement("option");
    option.value = index;
    const intersectionName = sp.intersection.intersectionName?.trim();
    let displayName;
    if (intersectionName) {
      displayName = intersectionName;
    } else {
      // 驗證 row 和 col 是否有效
      const row = Number.isFinite(sp.intersection.row) ? sp.intersection.row : null;
      const col = Number.isFinite(sp.intersection.col) ? sp.intersection.col : null;
      if (row !== null && col !== null) {
        displayName = `(${row},${col})`;
      } else {
        // 備用顯示：使用 position.x 和 position.y，或通用標識
        const posX = sp.intersection.position?.x?.toFixed(0) ?? '未知';
        const posY = sp.intersection.position?.y?.toFixed(0) ?? '未知';
        displayName = `(位置 ${posX},${posY})`;
      }
    }
    option.textContent = `${displayName} - 方向: ${sp.intersection.spawnPoint.direction}`;
    selector.appendChild(option);
  });
  
  // 填充路徑起點和終點選擇器
  populatePathSelectors();

  // 如果存在自訂路徑，則添加 "路徑" 選項
  if (customPath && customPath.length > 0) {
    const option = document.createElement("option");
    option.value = "custom_path";
    const startCircle = customPath[0].intersection;
    const endCircle = customPath[customPath.length - 1].intersection;
    
    const startName = startCircle.intersectionName?.trim() || `(${startCircle.row},${startCircle.col})`;
    const endName = endCircle.intersectionName?.trim() || `(${endCircle.row},${endCircle.col})`;

    option.textContent = `路徑: ${startName} -> ${endName}`;
    selector.appendChild(option);
  }

  // 嘗試恢復之前的選擇，如果不存在則選擇第一個
  if (Array.from(selector.options).some(opt => opt.value === currentValue)) {
      selector.value = currentValue;
  } else {
      selector.selectedIndex = 0;
  }
  
  renderSpawnDataDisplay(); // 保留原有的顯示更新調用
}

function updateSpawnDirectionPanel() {
  const isSpawn = document.getElementById("isSpawn").checked;
  document.getElementById("spawnDirectionPanel").style.display = isSpawn ? "block" : "none";
}
document.getElementById("isSpawn").addEventListener("change", function() {
  updateSpawnDirectionPanel();
  const isSpawn = this.checked;
  document.getElementById("phaseCount").value = isSpawn ? 1 : selectedCircle.phases.length;
  document.getElementById("phaseCount").disabled = isSpawn;
  renderPhases(isSpawn ? 1 : selectedCircle.phases.length, selectedCircle.phases, isSpawn, selectedCircle.spawnDirection);
});

document.getElementById("spawnDirection").addEventListener("change", function() {
  const isSpawn = document.getElementById("isSpawn").checked;
  if (isSpawn && selectedCircle) {
    const newDirection = this.value;
    // 更新時相 1 的車流流向
    selectedCircle.phases = [{
      activeDirections: [newDirection],
      greenTime: 1,
      redTime: 0
    }];
    // 重新渲染時相表單
    renderPhases(1, selectedCircle.phases, true, newDirection);
  }
});

document.getElementById("isSpawn").addEventListener("change", function() {
  updateSpawnDirectionPanel();
  const isSpawn = this.checked;
  if (selectedCircle) {
    document.getElementById("phaseCount").value = isSpawn ? 1 : selectedCircle.phases.length;
    document.getElementById("phaseCount").disabled = isSpawn;
    if (isSpawn) {
      // 勾選時，強制設置單一時相
      const spawnDirection = document.getElementById("spawnDirection").value;
      selectedCircle.phases = [{
        activeDirections: [spawnDirection],
        greenTime: 1,
        redTime: 0
      }];
    }
    renderPhases(isSpawn ? 1 : selectedCircle.phases.length, selectedCircle.phases, isSpawn, selectedCircle.spawnDirection);
  }
});


// 修改 drawDesignGrid 函數以支持鎖定顏色邏輯
function drawDesignGrid() {
  const canvas = document.getElementById("designCanvas");
  const dCtx = canvas.getContext("2d");

  const designWidth = GRID_SPACING_X * GRID_COLS + GRID_SPACING_X;
  const designHeight = GRID_SPACING_Y * GRID_ROWS + GRID_SPACING_Y;
  canvas.width = designWidth;
  canvas.height = designHeight;
  dCtx.clearRect(0, 0, designWidth, designHeight);

  // 繪製圓點和虛線
  gridCircles.forEach(circle => {
    const x = circle.col * GRID_SPACING_X + GRID_SPACING_X / 2;
    const y = circle.row * GRID_SPACING_Y + GRID_SPACING_Y / 2;
    circle.x = x;
    circle.y = y;

    // 繪製圓點
    dCtx.beginPath();
    dCtx.arc(x, y, CIRCLE_RADIUS, 0, Math.PI * 2);
    if (circle.selected) {
      if (circle.spawnEnabled) {
        dCtx.fillStyle = "red";
        dCtx.fill();
      } else if (circle.locked) {
        dCtx.fillStyle = "brown";
        dCtx.fill();
      } else {
        dCtx.fillStyle = "blue";
        dCtx.fill();
      }
      const offsetText = circle.offset.toString();
      dCtx.fillStyle = "white";
      dCtx.textAlign = "center";
      dCtx.textBaseline = "middle";
      const textWidth = dCtx.measureText("123").width;
      const maxFontSize = 14;
      const circleDiameter = CIRCLE_RADIUS * 2;
      let fontSize = maxFontSize;
      if (textWidth > circleDiameter * 0.8) {
        fontSize = Math.floor((circleDiameter * 0.8 / textWidth) * maxFontSize);
      }
      fontSize = Math.max(fontSize, 6);
      dCtx.font = `${fontSize}px Arial`;
      dCtx.fillText(offsetText, x, y);

      if (circle === selectedCircle) {
        dCtx.beginPath();
        dCtx.arc(x, y, CIRCLE_RADIUS + 4, 0, Math.PI * 2);
        dCtx.strokeStyle = "orange";
        dCtx.lineWidth = 2;
        dCtx.stroke();
      }
    } else {
      dCtx.strokeStyle = "gray";
      dCtx.stroke();
    }

    // 繪製8條虛線
    dCtx.strokeStyle = "#E0E0E0"; // 極淺灰色
    dCtx.lineWidth = 1;
    dCtx.setLineDash([5, 5]); // 虛線樣式

    const directions = [
      { dx: 0, dy: -1 },  // 上
      { dx: 0, dy: 1 },   // 下
      { dx: -1, dy: 0 },  // 左
      { dx: 1, dy: 0 },   // 右
      { dx: -1, dy: -1 }, // 左上
      { dx: 1, dy: -1 },  // 右上
      { dx: -1, dy: 1 },  // 左下
      { dx: 1, dy: 1 }    // 右下
    ];

    directions.forEach(dir => {
      const length = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) === 1 ? GRID_SPACING_X : GRID_SPACING_X * Math.SQRT2;
      const endX = x + dir.dx * length;
      const endY = y + dir.dy * length;
      const cos = dir.dx === 0 ? 0 : dir.dx / Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
      const sin = dir.dy === 0 ? 0 : dir.dy / Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
      const startX = x + CIRCLE_RADIUS * cos;
      const startY = y + CIRCLE_RADIUS * sin;

      dCtx.beginPath();
      dCtx.moveTo(startX, startY);
      dCtx.lineTo(endX, endY);
      dCtx.stroke();
    });

    dCtx.setLineDash([]); // 重置為實線
  });

  // 繪製已設定的道路（連線）
  for (let key in roadDistances) {
    let [c1Row, c1Col, c2Row, c2Col] = key.split(/[,|-]/).map(Number);
    let c1 = gridCircles.find(c => c.row === c1Row && c.col === c1Col);
    let c2 = gridCircles.find(c => c.row === c2Row && c.col === c2Col);
    if (c1 && c2 && c1.selected && c2.selected && roadDistances[key].distance !== -1) {
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const cos = dx / length;
      const sin = dy / length;
      const offsetX = CIRCLE_RADIUS * cos;
      const offsetY = CIRCLE_RADIUS * sin;

      dCtx.beginPath();
      dCtx.moveTo(c1.x + offsetX, c1.y + offsetY);
      dCtx.lineTo(c2.x - offsetX, c2.y - offsetY);
      dCtx.strokeStyle = "black";
      dCtx.lineWidth = 2;
      dCtx.stroke();

      const midX = (c1.x + c2.x) / 2;
      const midY = (c1.y + c2.y) / 2;
      dCtx.fillStyle = "black";
      dCtx.font = "12px Arial";
      dCtx.textAlign = "center";
      dCtx.fillText(`${roadDistances[key].distance}m`, midX, midY - 5);
      if (roadDistances[key].name) {
        dCtx.fillText(roadDistances[key].name, midX, midY + 10);
      }
    }
  }
}


drawDesignGrid();

function getZoomFactor() {
  return parseFloat(document.body.style.zoom) || 1; // 默認為 1
}

designCanvas.addEventListener("click", function(e) {
  const rect = designCanvas.getBoundingClientRect();
  const zoomFactor = getZoomFactor();
  const mx = (e.clientX - rect.left) / zoomFactor; // 校正 x 座標
  const my = (e.clientY - rect.top) / zoomFactor; // 校正 y 座標
  let hitCircle = null;

  // 檢查是否點擊圓點
  gridCircles.forEach(circle => {
    let dx = circle.x - mx, dy = circle.y - my;
    if (Math.sqrt(dx * dx + dy * dy) < CIRCLE_RADIUS) { // 使用全局半徑
      hitCircle = circle;
    }
  });

  // 處理圓點點擊
  if (hitCircle) {
    hitCircle.selected = !hitCircle.selected;
    selectedCircle = hitCircle.selected ? hitCircle : null;

    if (selectedCircle) {
      showCircleSettings(selectedCircle);
      const settingsPanel = document.getElementById("settingsPanel");
      const minimizedIcon = document.getElementById("minimizedIcon");
      const panelContent = document.getElementById("panelContent");
      restoreSettingsPanel(settingsPanel, minimizedIcon, panelContent, gcurrentX, gcurrentY);
    } else {
      document.getElementById("circleForm").style.display = "none";
      document.getElementById("circleInfo").textContent = "未選取";
    }
    drawDesignGrid();
	reFresh(); // 【增加此行】確保在選取或取消選取圓點後，都能更新時空圖
    return;
  }

  // 處理虛線點擊（8 個方向）
  let hitRoadKey = null;
  const directions = [
    { dx: 0, dy: -1, name: "N" },  // 上
    { dx: 0, dy: 1, name: "S" },   // 下
    { dx: -1, dy: 0, name: "W" },  // 左
    { dx: 1, dy: 0, name: "E" },   // 右
    { dx: -1, dy: -1, name: "NW" }, // 左上
    { dx: 1, dy: -1, name: "NE" },  // 右上
    { dx: -1, dy: 1, name: "SW" },  // 左下
    { dx: 1, dy: 1, name: "SE" }    // 右下
  ];

  for (let circle of gridCircles) {
    if (!circle.selected) continue;

    const x = circle.x;
    const y = circle.y;
    const row = circle.row;
    const col = circle.col;

    for (let dir of directions) {
      const targetRow = row + dir.dy;
      const targetCol = col + dir.dx;

      // 檢查目標點是否在網格範圍內
      if (targetRow < 0 || targetRow >= GRID_ROWS || targetCol < 0 || targetCol >= GRID_COLS) continue;

      // 尋找目標圓點
      const targetCircle = gridCircles.find(c => c.row === targetRow && c.col === targetCol);
      if (!targetCircle || !targetCircle.selected) continue;

      // 計算虛線的起點和終點
      const isDiagonal = Math.abs(dir.dx) + Math.abs(dir.dy) === 2;
      const length = isDiagonal ? GRID_SPACING_X * Math.SQRT2 : GRID_SPACING_X;
      const cos = dir.dx === 0 ? 0 : dir.dx / Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
      const sin = dir.dy === 0 ? 0 : dir.dy / Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
      const startX = x + CIRCLE_RADIUS * cos;
      const startY = y + CIRCLE_RADIUS * sin;
      const endX = x + dir.dx * length;
      const endY = y + dir.dy * length;

      // 檢查點擊位置是否在虛線附近（增加診斷日誌）
      const dist = pointLineDistance(mx, my, startX, startY, endX, endY);
      console.log(`檢查虛線: (${row},${col}) -> (${targetRow},${targetCol}), 方向: ${dir.name}, 距離: ${dist.toFixed(2)}`);

      if (dist < 10) { // 增加閾值到 10 像素，提高點擊靈敏度
        hitRoadKey = `${row},${col}-${targetRow},${targetCol}`;
        console.log(`命中虛線: ${hitRoadKey}`);
        break;
      }
    }
    if (hitRoadKey) break;
  }

  // 如果點擊到虛線，提示輸入距離和名稱
  if (hitRoadKey) {
    let [c1Row, c1Col, c2Row, c2Col] = hitRoadKey.split(/[,|-]/).map(Number);
    let c1 = gridCircles.find(c => c.row === c1Row && c.col === c1Col);
    let c2 = gridCircles.find(c => c.row === c2Row && c.col === c2Col);
    let currentData = roadDistances[hitRoadKey] || { 
      distance: (c1.spawnEnabled || c2.spawnEnabled) ? 50 : 150, 
      name: "" 
    };
    let newDist = prompt("請輸入此路段距離(公尺):", currentData.distance);
    let newName = prompt("請輸入此路段名稱:", currentData.name || "");
    if (newDist !== null) {
      roadDistances[hitRoadKey] = {
        distance: parseFloat(newDist),
        name: newName || ""
      };
      console.log(`更新路段: ${hitRoadKey}, 距離: ${newDist}, 名稱: ${newName}`);
    }
    drawDesignGrid();
    reFresh();
  } else {
    console.log("未命中任何虛線");
  }
});

// 輔助函數：計算點到線段的距離
function pointLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSquared = dx * dx + dy * dy;
  if (lenSquared === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSquared;
  t = Math.max(0, Math.min(1, t));
  
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
}

// 假設的 getZoomFactor 函數，根據你的代碼可能需要調整
function getZoomFactor() {
  return document.body.style.zoom ? parseFloat(document.body.style.zoom) : 1;
}



function pointLineDistance_old(px, py, x1, y1, x2, y2) {
  let A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  let dot = A * C + B * D;
  let len_sq = C * C + D * D;
  let param = (len_sq !== 0) ? dot / len_sq : -1;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  let dx = px - xx, dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function renderPhases(phaseCount, phasesData, isSpawn = false, spawnDirection = "E") {
  const container = document.getElementById("phasesContainer");
  container.innerHTML = "";
  const directions = ['N', 'S', 'E', 'W', 'NE', 'SW', 'SE', 'NW'];
  const directionSymbols = {
    'N': '↑', 'S': '↓', 'E': '→', 'W': '←', 'NE': '↗', 'SW': '↙', 'SE': '↘', 'NW': '↖'
  };
  const leftTurnDirectionSymbols = {
    'NL': '↑L', 'SL': '↓L', 'EL': '→L', 'WL': '←L', 
    'NEL': '↗L', 'SWL': '↙L', 'SEL': '↘L', 'NWL': '↖L'
  };
  const rightTurnDirectionSymbols = {
    'NR': '↑R', 'SR': '↓R', 'ER': '→R', 'WR': '←R', 
    'NER': '↗R', 'SWR': '↙R', 'SER': '↘R', 'NWR': '↖R'
  };
  const defaultDirections = [['N', 'S'], ['E', 'W']];

  for (let i = 0; i < phaseCount; i++) {
    const phase = phasesData[i] || {
      activeDirections: defaultDirections[i] || [],
      leftTurnDirections: [],
      rightTurnDirections: [], // 新增：右轉方向
      greenTime: 10,
      redTime: 1
    };
    // 確保 leftTurnDirections 和 rightTurnDirections 存在
    if (!phase.leftTurnDirections) phase.leftTurnDirections = [];
    if (!phase.rightTurnDirections) phase.rightTurnDirections = [];

    const phaseDiv = document.createElement("div");
    phaseDiv.className = "phase-section";
    phaseDiv.innerHTML = `<h4>時相 ${i + 1}</h4>`;

    // 創建表格
    const table = document.createElement("table");
    table.className = "direction-table";

    // Row 0: 主要方向符號
    const row0 = document.createElement("tr");
    row0.innerHTML = `<th></th>`;
    directions.forEach(dir => {
      row0.innerHTML += `<td>${directionSymbols[dir]}</td>`;
    });
    table.appendChild(row0);

    // Row 1: 主要方向與checkbox
    const row1 = document.createElement("tr");
    row1.innerHTML = `<th class="main-direction">主要方向</th>`;
    directions.forEach(dir => {
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = `phase${i}_dir_${dir}`;
      checkbox.value = dir;
      let isChecked = phase.activeDirections.includes(dir);

      if (isSpawn && i === 0) {
        switch (spawnDirection) {
          case 'E': isChecked = (dir === 'E' || dir === 'W'); break;
          case 'W': isChecked = (dir === 'W' || dir === 'E'); break;
          case 'N': isChecked = (dir === 'N' || dir === 'S'); break;
          case 'S': isChecked = (dir === 'S' || dir === 'N'); break;
          case 'NE': isChecked = (dir === 'NE' || dir === 'SW'); break;
          case 'SW': isChecked = (dir === 'SW' || dir === 'NE'); break;
          case 'SE': isChecked = (dir === 'SE' || dir === 'NW'); break;
          case 'NW': isChecked = (dir === 'NW' || dir === 'SE'); break;
          default: isChecked = false;
        }
        checkbox.disabled = true;
      } else {
        isChecked = phase.activeDirections.includes(dir);
      }

      checkbox.checked = isChecked;
      if (isChecked) checkbox.setAttribute("checked", "checked");
      td.appendChild(checkbox);
      row1.appendChild(td);
    });
    table.appendChild(row1);

    // Row 2: 左轉方向與checkbox
    const row2 = document.createElement("tr");
    row2.innerHTML = `<th class="left-turn-direction">左轉(L)</th>`;
    directions.forEach(baseDir => {
      const leftTurnDir = baseDir + 'L';
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = `phase${i}_left_dir_${leftTurnDir}`;
      checkbox.value = leftTurnDir;
      
      let isChecked = phase.leftTurnDirections.includes(leftTurnDir);

      if (isSpawn && i === 0) {
        checkbox.disabled = true;
        isChecked = false;
      }
      
      checkbox.checked = isChecked;
      if (isChecked) checkbox.setAttribute("checked", "checked");
      td.appendChild(checkbox);
      row2.appendChild(td);
    });
    table.appendChild(row2);

    // Row 3: 右轉方向與checkbox
    const row3 = document.createElement("tr");
    row3.innerHTML = `<th class="right-turn-direction">右轉(R)</th>`;
    directions.forEach(baseDir => {
      const rightTurnDir = baseDir + 'R';
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = `phase${i}_right_dir_${rightTurnDir}`;
      checkbox.value = rightTurnDir;
      
      let isChecked = phase.rightTurnDirections.includes(rightTurnDir);

      if (isSpawn && i === 0) {
        checkbox.disabled = true;
        isChecked = false;
      }
      
      checkbox.checked = isChecked;
      if (isChecked) checkbox.setAttribute("checked", "checked");
      td.appendChild(checkbox);
      row3.appendChild(td);
    });
    table.appendChild(row3);

    phaseDiv.appendChild(table);

    // 綠燈與紅燈輸入框
    const greenTime = isSpawn ? 1 : phase.greenTime;
    const redTime = isSpawn ? 0 : phase.redTime;
    phaseDiv.innerHTML += `
      <div><label>綠燈秒數:</label><input type="number" name="phase${i}_green" value="${greenTime}" min="0" ${isSpawn ? 'disabled' : ''}></div>
      <div><label>黃燈+全紅秒數:</label><input type="number" name="phase${i}_red" value="${redTime}" min="0" ${isSpawn ? 'disabled' : ''}></div>
    `;
    container.appendChild(phaseDiv);

    // 添加事件監聽以更新週期
    if (!isSpawn) {
      const greenInput = phaseDiv.querySelector(`input[name="phase${i}_green"]`);
      const redInput = phaseDiv.querySelector(`input[name="phase${i}_red"]`);
      directions.forEach(dir => {
        const mainDirCheckbox = phaseDiv.querySelector(`input[name="phase${i}_dir_${dir}"]`);
        mainDirCheckbox.addEventListener("change", updatePhaseData);
        
        const leftTurnDir = dir + 'L';
        const leftTurnCheckbox = phaseDiv.querySelector(`input[name="phase${i}_left_dir_${leftTurnDir}"]`);
        if (leftTurnCheckbox) {
          leftTurnCheckbox.addEventListener("change", updatePhaseData);
        }

        const rightTurnDir = dir + 'R';
        const rightTurnCheckbox = phaseDiv.querySelector(`input[name="phase${i}_right_dir_${rightTurnDir}"]`);
        if (rightTurnCheckbox) {
          rightTurnCheckbox.addEventListener("change", updatePhaseData);
        }
      });
      greenInput.addEventListener("input", updatePhaseData);
      redInput.addEventListener("input", updatePhaseData);
    }
  }

  // 初始更新週期顯示
  if (selectedCircle) {
    updateCycleTimeDisplay(selectedCircle);
  }

  // 更新時相數據的輔助函數
  function updatePhaseData() {
    if (!selectedCircle) return;
    const isSpawnCurrent = document.getElementById("isSpawn").checked;
    const phaseCountCurrent = isSpawnCurrent ? 1 : parseInt(document.getElementById("phaseCount").value);
    
    const newPhases = [];
    for (let j = 0; j < phaseCountCurrent; j++) {
      const activeDirections = directions.filter(dir => {
        const cb = document.querySelector(`input[name="phase${j}_dir_${dir}"]`);
        return cb && cb.checked;
      });
      
      const leftTurnDirections = [];
      directions.forEach(baseDir => {
        const leftTurnDir = baseDir + 'L';
        const cb = document.querySelector(`input[name="phase${j}_left_dir_${leftTurnDir}"]`);
        if (cb && cb.checked) {
          leftTurnDirections.push(leftTurnDir);
        }
      });

      const rightTurnDirections = [];
      directions.forEach(baseDir => {
        const rightTurnDir = baseDir + 'R';
        const cb = document.querySelector(`input[name="phase${j}_right_dir_${rightTurnDir}"]`);
        if (cb && cb.checked) {
          rightTurnDirections.push(rightTurnDir);
        }
      });

      const greenTimeInput = document.querySelector(`input[name="phase${j}_green"]`);
      const redTimeInput = document.querySelector(`input[name="phase${j}_red"]`);

      const greenTime = greenTimeInput ? (parseFloat(greenTimeInput.value) || 0) : (isSpawnCurrent ? 1 : 0);
      const redTime = redTimeInput ? (parseFloat(redTimeInput.value) || 0) : (isSpawnCurrent ? 0 : 0);
      
      newPhases.push({ activeDirections, leftTurnDirections, rightTurnDirections, greenTime, redTime });
    }
    selectedCircle.phases = newPhases;
    updateCycleTimeDisplay(selectedCircle);
    // reFresh(); // 根據需求決定是否在此處調用 reFresh()
  }
}

// 修改 showCircleSettings 函數以顯示鎖定狀態
function showCircleSettings(circle) {
	selectedCircle = circle;
  // 修改：顯示路口名稱或座標
  const displayName = circle.intersectionName.trim() ? circle.intersectionName : `${circle.row},${circle.col}`;
  document.getElementById("circleInfo").textContent = `路口位置：${displayName}`;
  document.getElementById("intersectionName").value = circle.intersectionName || "";
  document.getElementById("isMaster").checked = circle.isMaster;
  document.getElementById("masterName").value = circle.masterName || '';
  // 填充引用主燈號下拉清單
  const refMasterSelect = document.getElementById("refMaster");
  refMasterSelect.innerHTML = '<option value="">不引用</option>';
  gridCircles.forEach(c => {
    if (c.isMaster && c !== circle) {
      const option = document.createElement("option");
      option.value = `${c.row}-${c.col}`;
      option.textContent = c.masterName || `路口 ${c.row + 1}-${c.col + 1}`;
      refMasterSelect.appendChild(option);
    }
  });
  refMasterSelect.value = circle.refMaster || '';

  updateMasterUI(circle);

  const isSpawn = circle.spawnEnabled;
  document.getElementById("phaseCount").value = isSpawn ? 1 : circle.phases.length;
  document.getElementById("phaseCount").disabled = isSpawn;
  renderPhases(isSpawn ? 1 : circle.phases.length, circle.phases, isSpawn, circle.spawnDirection);
  document.getElementById("offset").value = circle.offset;
  document.getElementById("isLocked").checked = circle.locked;
  document.getElementById("isSpawn").checked = circle.spawnEnabled;
  document.getElementById("spawnFreq").value = circle.spawnFrequency;
  document.getElementById("spawnDirection").value = circle.spawnDirection;
  document.getElementById("spawnName").value = circle.spawnName || "";
  updateSpawnDirectionPanel();
  document.getElementById("circleForm").style.display = "block";

  // 更新週期顯示
  updateCycleTimeDisplay(circle);
}

document.getElementById("intersectionName").addEventListener("input", function() {
  selectedCircle.intersectionName = this.value;
});

function updateRefOffsets(masterCircle) {
  gridCircles.forEach(circle => {
    if (circle.refMaster === `${masterCircle.row}-${masterCircle.col}`) {
      circle.offset = masterCircle.offset; // 更新引用路口的時差
      if (selectedCircle === circle) { // 如果該路口正在編輯
        document.getElementById("offset").value = circle.offset; // 更新顯示
      }
    }
  });
}

	
document.getElementById("isMaster").addEventListener("change", function() {
  selectedCircle.isMaster = this.checked;
  if (this.checked) {
    selectedCircle.refMaster = null; // 主燈號不引用其他主燈號
  }
  updateMasterUI(selectedCircle);
});

document.getElementById("isLocked").addEventListener("change", function() {
  selectedCircle.locked = this.checked;
  if (this.checked) {
    selectedCircle.refMaster = null; // 鎖定時取消引用
  }
  updateMasterUI(selectedCircle);
});

document.getElementById("refMaster").addEventListener("change", function() {
  selectedCircle.refMaster = this.value || null;
  if (selectedCircle.refMaster) {
    const masterCircle = gridCircles.find(c => `${c.row}-${c.col}` === selectedCircle.refMaster);
    if (masterCircle) {
      selectedCircle.offset = masterCircle.offset;
      document.getElementById("offset").value = selectedCircle.offset;
    }
  }
  updateMasterUI(selectedCircle); // 更新時差欄位狀態
});

document.getElementById("refMaster").addEventListener("change", function() {
  selectedCircle.refMaster = this.value || null;
  if (selectedCircle.refMaster) {
    const masterCircle = gridCircles.find(c => `${c.row}-${c.col}` === selectedCircle.refMaster);
    if (masterCircle) {
      selectedCircle.offset = masterCircle.offset;
      document.getElementById("offset").value = selectedCircle.offset;
    }
  }
  updateMasterUI(selectedCircle); // 更新時差欄位狀態
});

document.getElementById("masterName").addEventListener("input", function() {
  selectedCircle.masterName = this.value;
  updateAllRefMasterDropdowns(); // 同步更新所有下拉清單
});



document.getElementById("offset").addEventListener("input", function() {
  if (!this.disabled) { // 僅在非唯讀時更新
    selectedCircle.offset = parseInt(this.value) || 0;
    if (selectedCircle.isMaster) { // 如果是主燈號，更新引用路口
      updateRefOffsets(selectedCircle);
    }
  }
  drawDesignGrid(); // 即時更新畫布上的時差數字
  reFresh(); // 更新時空圖
});

function updateMasterUI(circle) {
  const isMaster = document.getElementById("isMaster").checked;
  const isLocked = document.getElementById("isLocked").checked;
  const refMaster = document.getElementById("refMaster").value;
  const offsetInput = document.getElementById("offset");

  // 控制主燈號名稱和引用下拉清單的顯示
  document.getElementById("masterNamePanel").style.display = isMaster ? "block" : "none";
  document.getElementById("refMasterPanel").style.display = (!isMaster && !isLocked) ? "block" : "none";

  // 控制時差欄位是否唯讀
  offsetInput.disabled = !!refMaster; // 如果引用主燈號，設為唯讀
  if (refMaster) {
    const masterCircle = gridCircles.find(c => `${c.row}-${c.col}` === refMaster);
    if (masterCircle) {
      offsetInput.value = masterCircle.offset; // 顯示主燈號的時差
    }
  }
}

function updateAllRefMasterDropdowns() {
  gridCircles.forEach(circle => {
    if (!circle.isMaster && !circle.locked) { // 只更新非主燈號且未鎖定的路口
      const refMasterSelect = document.getElementById("refMaster");
      if (refMasterSelect && selectedCircle === circle) { // 僅更新當前選中的路口
        const currentValue = refMasterSelect.value;
        refMasterSelect.innerHTML = '<option value="">不引用</option>';
        gridCircles.forEach(c => {
          if (c.isMaster) {
            const option = document.createElement("option");
            option.value = `${c.row}-${c.col}`;
            option.textContent = c.masterName || `路口 ${c.row + 1}-${c.col + 1}`;
            refMasterSelect.appendChild(option);
          }
        });
        refMasterSelect.value = currentValue; // 保留當前選擇
      }
    }
  });
}

// 修改表單提交事件以保存鎖定狀態

document.getElementById("phaseCount").addEventListener("change", function() {
  const isSpawn = document.getElementById("isSpawn").checked;
  if (isSpawn) {
    this.value = 1;
    return;
  }
  const count = parseInt(this.value);
  if (selectedCircle) {
    while (selectedCircle.phases.length < count) {
      selectedCircle.phases.push({ activeDirections: [], greenTime: 10, redTime: 1 });
    }
    selectedCircle.phases = selectedCircle.phases.slice(0, count);
    renderPhases(count, selectedCircle.phases, isSpawn, selectedCircle.spawnDirection);
    updateCycleTimeDisplay(selectedCircle); // Update cycle time after changing phase count
  }
});

// 修改 change 事件以即時更新鎖定狀態

// (取代) 修改後的 change 事件監聽器，更簡潔且修正了 ID 錯誤
document.getElementById("circleForm").addEventListener("change", function(e) {
  if (!selectedCircle) return;

  const target = e.target;
  const isSpawn = document.getElementById("isSpawn").checked;
  const phaseCountInput = document.getElementById("phaseCount");
  const spawnDirection = document.getElementById("spawnDirection").value;

  // 更新路口名稱
  if (target.id === "intersectionName") {
    selectedCircle.intersectionName = target.value;
    const displayName = selectedCircle.intersectionName.trim() 
      ? selectedCircle.intersectionName 
      : `(${selectedCircle.row},${selectedCircle.col})`;
    document.getElementById("circleInfo").textContent = `路口位置：${displayName}`;
    
    // 【核心修正 1】在名稱變更後，立即調用 reFresh 來更新所有相關數據和 UI
    reFresh(); 
    return;
  }

  // 更新鎖定狀態
  if (target.id === "isLocked") {
    selectedCircle.locked = target.checked;
    drawDesignGrid();
    reFresh();
    return;
  }

  // 更新生成點相關屬性
  if (target.id === "isSpawn") {
    selectedCircle.spawnEnabled = target.checked;
    phaseCountInput.disabled = target.checked;
    if (target.checked) {
      phaseCountInput.value = 1;
      selectedCircle.phases = [{
        activeDirections: getSpawnActiveDirections(spawnDirection),
        leftTurnDirections: [],
        rightTurnDirections: [],
        greenTime: 1,
        redTime: 0
      }];
    } else {
      selectedCircle.phases = [
        { activeDirections: ['N', 'S'], leftTurnDirections: [], rightTurnDirections: [], greenTime: 10, redTime: 1 },
        { activeDirections: ['E', 'W'], leftTurnDirections: [], rightTurnDirections: [], greenTime: 10, redTime: 1 }
      ];
      phaseCountInput.value = selectedCircle.phases.length;
    }
    renderPhases(selectedCircle.phases.length, selectedCircle.phases, target.checked, spawnDirection);
    updateCycleTimeDisplay(selectedCircle);
    reFresh();
    return;
  }
  
  if (target.id === "spawnFreq") {
    const frequency = parseFloat(target.value) || 5;
    selectedCircle.spawnFrequency = Math.max(0, frequency);
    reFresh();
    return;
  }
  
  if (target.id === "spawnDirection") {
    if (isSpawn) {
        selectedCircle.spawnDirection = target.value;
        selectedCircle.phases = [{
            activeDirections: getSpawnActiveDirections(target.value),
            leftTurnDirections: [],
            rightTurnDirections: [],
            greenTime: 1,
            redTime: 0
        }];
        renderPhases(1, selectedCircle.phases, true, target.value);
        updateCycleTimeDisplay(selectedCircle);
        reFresh();
    }
    return;
  }
  
  if (target.id === "spawnName") {
    selectedCircle.spawnName = target.value;
    
    // 【核心修正 2】同樣地，在 spawnName 變更後也立即調用 reFresh
    reFresh();
    return;
  }

  // 更新時相數量
  if (target.id === "phaseCount" && !isSpawn) {
    const newCount = parseInt(target.value) || 1;
    const currentCount = selectedCircle.phases.length;
    if (newCount > currentCount) {
      for (let i = currentCount; i < newCount; i++) {
        selectedCircle.phases.push({
          activeDirections: [],
          leftTurnDirections: [],
          rightTurnDirections: [],
          greenTime: 10,
          redTime: 1
        });
      }
    } else if (newCount < currentCount) {
      selectedCircle.phases = selectedCircle.phases.slice(0, newCount);
    }
    renderPhases(newCount, selectedCircle.phases, false, spawnDirection);
    updateCycleTimeDisplay(selectedCircle);
    reFresh();
    return;
  }

  // 更新主燈號、引用等相關邏輯
  if (target.id === 'isMaster' || target.id === 'masterName' || target.id === 'refMaster' || target.id === 'isLocked') {
      selectedCircle.isMaster = document.getElementById("isMaster").checked;
      selectedCircle.masterName = document.getElementById("masterName").value;
      selectedCircle.refMaster = document.getElementById("refMaster").value || null;
      selectedCircle.locked = document.getElementById("isLocked").checked;
      
      if (selectedCircle.isMaster || selectedCircle.locked) {
        selectedCircle.refMaster = null;
      }
      
      if(selectedCircle.refMaster){
         const masterCircle = gridCircles.find(c => `${c.row}-${c.col}` === selectedCircle.refMaster);
         if(masterCircle){
            selectedCircle.offset = masterCircle.offset;
            document.getElementById("offset").value = selectedCircle.offset;
         }
      }

      updateMasterUI(selectedCircle);
      updateAllRefMasterDropdowns();
      drawDesignGrid();
      reFresh();
      return;
  }

  // 如果事件源自時相內部（綠燈、紅燈、方向勾選），則刷新
  if (target.name && (target.name.startsWith('phase') || target.name.startsWith('dir'))) {
    reFresh();
  }
});
// 輔助函數：根據生成點方向返回對應的活躍方向
function getSpawnActiveDirections(direction) {
  switch (direction) {
    case 'E': return ['E', 'W'];
    case 'W': return ['W', 'E'];
    case 'N': return ['N', 'S'];
    case 'S': return ['S', 'N'];
    case 'NE': return ['NE', 'SW'];
    case 'SW': return ['SW', 'NE'];
    case 'SE': return ['SE', 'NW'];
    case 'NW': return ['NW', 'SE'];
    default: return [];
  }
}

let designIntersections = [];
let designRoads = [];

function generateDesignNetwork() {
  designIntersections = [];
  designRoads = [];
  let intersectionIndexMap = new Map();
  gridCircles.forEach((circle, index) => {
    if (circle.selected) {
      designIntersections.push({
        index: index,
        row: circle.row,
        col: circle.col,
        position: { x: circle.x, y: circle.y },
        phases: circle.phases,
        offset: circle.offset,
        spawnPoint: {
          enabled: circle.spawnEnabled,
          frequency: circle.spawnFrequency,
          direction: circle.spawnDirection,
          spawnName: circle.spawnName
        }
      });
      intersectionIndexMap.set(circle, designIntersections.length - 1);
    }
  });

  let adjacencyList = {};
  for (let r = 0; r < GRID_ROWS; r++) {
    let rowCircles = gridCircles.filter(c => c.row === r && c.selected);
    rowCircles.sort((a, b) => a.col - b.col);
    for (let i = 0; i < rowCircles.length - 1; i++) {
      let c1 = rowCircles[i], c2 = rowCircles[i + 1];
      let key = `${c1.row},${c1.col}-${c2.row},${c2.col}`;
      if (roadDistances[key]) {
        let idx1 = intersectionIndexMap.get(c1);
        let idx2 = intersectionIndexMap.get(c2);
        if (!adjacencyList[idx1]) adjacencyList[idx1] = [];
        if (!adjacencyList[idx2]) adjacencyList[idx2] = [];
        let distance = roadDistances[key].distance || 50;
        adjacencyList[idx1].push({ neighborIndex: idx2, distance, orientation: 'horizontal' });
        adjacencyList[idx2].push({ neighborIndex: idx1, distance, orientation: 'horizontal' });
        designRoads.push({
          orientation: 'horizontal',
          start: c1,
          end: c2,
          distance: distance,
          name: roadDistances[key].name || "",
          indexStart: idx1,
          indexEnd: idx2
        });
      }
    }
  }
  for (let c = 0; c < GRID_COLS; c++) {
    let colCircles = gridCircles.filter(circ => circ.col === c && circ.selected);
    colCircles.sort((a, b) => a.row - b.row);
    for (let i = 0; i < colCircles.length - 1; i++) {
      let c1 = colCircles[i], c2 = colCircles[i + 1];
      let key = `${c1.row},${c1.col}-${c2.row},${c2.col}`;
      if (roadDistances[key]) {
        let idx1 = intersectionIndexMap.get(c1);
        let idx2 = intersectionIndexMap.get(c2);
        if (!adjacencyList[idx1]) adjacencyList[idx1] = [];
        if (!adjacencyList[idx2]) adjacencyList[idx2] = [];
        let distance = roadDistances[key].distance || 50;
        adjacencyList[idx1].push({ neighborIndex: idx2, distance, orientation: 'vertical' });
        adjacencyList[idx2].push({ neighborIndex: idx1, distance, orientation: 'vertical' });
        designRoads.push({
          orientation: 'vertical',
          start: c1,
          end: c2,
          distance: distance,
          name: roadDistances[key].name || "",
          indexStart: idx1,
          indexEnd: idx2
        });
      }
    }
  }
  designIntersections.forEach(inter => {
    inter.adjacencyList = adjacencyList[intersectionIndexMap.get(gridCircles.find(c => c.row === inter.row && c.col === inter.col))] || [];
  });

  generateSimSpawnPoints();
  precomputeTrafficLightStates(); // 確保在此處初始化 trafficLightStates
  updateSpacetimeOffscreen();
  renderSpawnDataDisplay(); // 在 trafficLightStates 準備好後調用
}

    const simCanvas = document.getElementById("simCanvas");
    const sCtx = simCanvas.getContext("2d");
    let simIntersections = [];
    let simRoads = [];
    let simSpawnPoints = [];
    let simulationRunning = false;
    let scale = 1.0;
    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let lastMouseX, lastMouseY;

    function worldToScreen(x, y) {
      return { x: (x + offsetX) * scale, y: (y + offsetY) * scale };
    }

    function screenToWorld(screenX, screenY) {
      return { x: screenX / scale - offsetX, y: screenY / scale - offsetY };
    }

    simCanvas.addEventListener("wheel", function(e) {
      e.preventDefault();
      const zoomFactor = 0.05;
      const zoom = e.deltaY < 0 ? 1 + zoomFactor : 1 - zoomFactor;
      const mouseX = e.clientX - simCanvas.getBoundingClientRect().left;
      const mouseY = e.clientY - simCanvas.getBoundingClientRect().top;
      const worldPosBefore = screenToWorld(mouseX, mouseY);
      scale *= zoom;
      const worldPosAfter = screenToWorld(mouseX, mouseY);
      offsetX += worldPosBefore.x - worldPosAfter.x;
      offsetY += worldPosBefore.y - worldPosAfter.y;
    });

    simCanvas.addEventListener("mousedown", function(e) {
      if (e.button === 0) {
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    });

    simCanvas.addEventListener("mousemove", function(e) {
      if (isPanning) {
        const dx = (e.clientX - lastMouseX) / scale;
        const dy = (e.clientY - lastMouseY) / scale;
        offsetX += dx;
        offsetY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    });

    simCanvas.addEventListener("mouseup", function(e) {
      if (e.button === 0) { isPanning = false; }
    });

    function generateSimSpawnPoints() {
      simSpawnPoints = [];
      spawnPointsList = [];
      continuousRoadsBySpawn = {};

      simIntersections.forEach((intersect, idx) => {
        if (intersect.spawnPoint && intersect.spawnPoint.enabled) {
          const spawnPoint = {
            type: 'intersection',
            intersection: intersect,
            spawnFrequency: intersect.spawnPoint.frequency,
            timer: 0,
            id: `spawn_${idx}`
          };
          simSpawnPoints.push(spawnPoint);
          spawnPointsList.push(spawnPoint);
          continuousRoadsBySpawn[spawnPoint.id] = getContinuousRoadsFromSpawn(intersect);
        }
      });

      updateSpawnPointSelector();
    }

function getContinuousRoadsFromSpawn(intersect) {
  const direction = intersect.spawnPoint.direction; // 起點方向，例如 'NE' 或 'E'
  let roads = []; // 儲存連續道路的陣列
  let lastPoint = { x: intersect.position.x, y: intersect.position.y }; // 從起點路口開始

  console.log(`開始從路口 (${lastPoint.x}, ${lastPoint.y}) 尋找 ${direction} 方向的連續道路`);

  while (true) {
    // 列出所有 simRoads 以診斷數據
    console.log('當前 simRoads 內容：');
    simRoads.forEach((road, idx) => {
      console.log(`道路 ${idx}: ${road.direction}, 起點: (${road.start.x}, ${road.start.y}), 終點: (${road.end.x}, ${road.end.y})`);
    });

    let nextRoad = simRoads.find(road => {
      const startMatches = Math.abs(road.start.x - lastPoint.x) < 5 && Math.abs(road.start.y - lastPoint.y) < 5;
      const endMatches = Math.abs(road.end.x - lastPoint.x) < 5 && Math.abs(road.end.y - lastPoint.y) < 5;
      const nonZeroDistance = road.distance !== 0;

      if (direction === 'N') {
        return (road.orientation === 'vertical' && road.direction === 'N' && startMatches) ||
               (road.orientation === 'vertical' && road.direction === 'S' && endMatches) && nonZeroDistance;
      } else if (direction === 'S') {
        return (road.orientation === 'vertical' && road.direction === 'S' && startMatches) ||
               (road.orientation === 'vertical' && road.direction === 'N' && endMatches) && nonZeroDistance;
      } else if (direction === 'E') {
        return (road.orientation === 'horizontal' && road.direction === 'E' && startMatches) ||
               (road.orientation === 'horizontal' && road.direction === 'W' && endMatches) && nonZeroDistance;
      } else if (direction === 'W') {
        return (road.orientation === 'horizontal' && road.direction === 'W' && startMatches) ||
               (road.orientation === 'horizontal' && road.direction === 'E' && endMatches) && nonZeroDistance;
      } else if (direction === 'NE') {
        return (road.orientation === 'diagonal' && road.direction === 'NE' && startMatches) ||
               (road.orientation === 'diagonal' && road.direction === 'SW' && endMatches) && nonZeroDistance;
      } else if (direction === 'SW') {
        return (road.orientation === 'diagonal' && road.direction === 'SW' && startMatches) ||
               (road.orientation === 'diagonal' && road.direction === 'NE' && endMatches) && nonZeroDistance;
      } else if (direction === 'SE') {
        return (road.orientation === 'diagonal' && road.direction === 'SE' && startMatches) ||
               (road.orientation === 'diagonal' && road.direction === 'NW' && endMatches) && nonZeroDistance;
      } else if (direction === 'NW') {
        return (road.orientation === 'diagonal' && road.direction === 'NW' && startMatches) ||
               (road.orientation === 'diagonal' && road.direction === 'SE' && endMatches) && nonZeroDistance;
      }
    });

    if (nextRoad) {
      console.log(`找到道路: ${nextRoad.direction}, 起點: (${nextRoad.start.x}, ${nextRoad.start.y}) -> 終點: (${nextRoad.end.x}, ${nextRoad.end.y}), 距離: ${nextRoad.distance}`);

      let adjustedNextRoad = { ...nextRoad };

      // 如果道路方向與起點方向相反，則反轉
      if (direction === 'N' && nextRoad.direction === 'S' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'N';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = nextRoad.laneNegative;
        adjustedNextRoad.laneNegative = nextRoad.lanePositive;
      } else if (direction === 'S' && nextRoad.direction === 'N' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'S';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = nextRoad.laneNegative;
        adjustedNextRoad.laneNegative = nextRoad.lanePositive;
      } else if (direction === 'E' && nextRoad.direction === 'W' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'E';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = nextRoad.laneNegative;
        adjustedNextRoad.laneNegative = nextRoad.lanePositive;
      } else if (direction === 'W' && nextRoad.direction === 'E' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'W';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = nextRoad.laneNegative;
        adjustedNextRoad.laneNegative = nextRoad.lanePositive;
      } else if (direction === 'NE' && nextRoad.direction === 'SW' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'NE';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = { x: nextRoad.laneNegative.x, y: nextRoad.laneNegative.y };
        adjustedNextRoad.laneNegative = { x: nextRoad.lanePositive.x, y: nextRoad.lanePositive.y };
      } else if (direction === 'SW' && nextRoad.direction === 'NE' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'SW';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = { x: nextRoad.laneNegative.x, y: nextRoad.laneNegative.y };
        adjustedNextRoad.laneNegative = { x: nextRoad.lanePositive.x, y: nextRoad.lanePositive.y };
      } else if (direction === 'SE' && nextRoad.direction === 'NW' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'SE';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = { x: nextRoad.laneNegative.x, y: nextRoad.laneNegative.y };
        adjustedNextRoad.laneNegative = { x: nextRoad.lanePositive.x, y: nextRoad.lanePositive.y };
      } else if (direction === 'NW' && nextRoad.direction === 'SE' && Math.abs(nextRoad.end.x - lastPoint.x) < 5 && Math.abs(nextRoad.end.y - lastPoint.y) < 5) {
        adjustedNextRoad.direction = 'NW';
        [adjustedNextRoad.start, adjustedNextRoad.end] = [nextRoad.end, nextRoad.start];
        adjustedNextRoad.lanePositive = { x: nextRoad.laneNegative.x, y: nextRoad.laneNegative.y };
        adjustedNextRoad.laneNegative = { x: nextRoad.lanePositive.x, y: nextRoad.lanePositive.y };
      }

      roads.push(adjustedNextRoad);
      lastPoint = adjustedNextRoad.end; // 更新為下一段的起點
    } else {
      console.log(`未找到 ${direction} 方向的下一條路，結束搜尋`);
      break;
    }
  }

  console.log(`生成點方向 ${direction} 的連續道路數量: ${roads.length}`);
  return roads;
}

	
// 全局變數定義（部分摘錄，保持與原代碼一致）
let simLastTimeAnim = 0;
let lastSpacetimeUpdate = 0; // 上次時空圖更新的時間
const SPACETIME_UPDATE_INTERVAL = 1000; // 時空圖更新間隔（毫秒）

const stCanvas = document.getElementById("spacetimeCanvas");
const stCtx = stCanvas.getContext("2d");
const offscreenCanvas = new OffscreenCanvas(stCanvas.width, stCanvas.height);
const offscreenCtx = offscreenCanvas.getContext("2d");



// 更新離屏畫布的時空圖
function updateSpacetimeOffscreen() {
  offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  let pathData, maxDistance, maxTime;
  const margin = 15;
  
  if (selectedSpawnIndex === 'custom_path' && customPath) {
    pathData = customPath;
    maxDistance = pathData.reduce((sum, seg) => sum + seg.distanceToNext, 0);
  } else if (typeof selectedSpawnIndex === 'number' && spawnPointsList[selectedSpawnIndex]) {
    const selectedSpawn = spawnPointsList[selectedSpawnIndex];
    const roads = continuousRoadsBySpawn[selectedSpawn.id];
    if (!roads || roads.length === 0) return;
    
    pathData = [];
    roads.forEach((road, index) => {
        const startIntersect = simIntersections.find(inter =>
            Math.abs(inter.position.x - road.start.x) < 5 &&
            Math.abs(inter.position.y - road.start.y) < 5
        );
        if (startIntersect) {
            pathData.push({
                intersection: startIntersect,
                movement: selectedSpawn.intersection.spawnPoint.direction,
                distanceToNext: road.distance
            });
        }
        if (index === roads.length - 1) {
             const endIntersect = simIntersections.find(inter =>
                Math.abs(inter.position.x - road.end.x) < 5 &&
                Math.abs(inter.position.y - road.end.y) < 5
            );
            if(endIntersect) {
                 pathData.push({
                    intersection: endIntersect,
                    movement: selectedSpawn.intersection.spawnPoint.direction,
                    distanceToNext: 0
                });
            }
        }
    });
    maxDistance = roads.reduce((sum, road) => sum + road.distance, 0);
  } else {
    return;
  }

  if (!pathData || pathData.length === 0) return;
  
  maxTime = fixedSimulationDuration / timeScale;
  const timeScaleFactor = offscreenCanvas.width / maxTime;
  const drawableHeight = offscreenCanvas.height - 2 * margin;
  const distanceScale = maxDistance > 0 ? drawableHeight / maxDistance : 1;

  // Draw time ticks (程式碼不變)
  const timeTickInterval = 50 / timeScale;
  for (let i = 0; i <= Math.floor(maxTime / timeTickInterval); i++) {
    const time = i * timeTickInterval;
    const x = time * timeScaleFactor;
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(x, offscreenCanvas.height);
    offscreenCtx.lineTo(x, offscreenCanvas.height - 10);
    offscreenCtx.strokeStyle = "black";
    offscreenCtx.lineWidth = 1;
    offscreenCtx.stroke();
    offscreenCtx.fillStyle = "black";
    offscreenCtx.font = "12px Arial";
    offscreenCtx.fillText(`${(time * timeScale).toFixed(0)}s`, x - 10, offscreenCanvas.height - 5);
  }

  // Draw distance ticks (程式碼不變)
  const distTickInterval = Math.ceil(maxDistance / 5 / 10) * 10;
  for (let i = 0; i <= Math.floor(maxDistance / distTickInterval); i++) {
    const distance = i * distTickInterval;
    const y = offscreenCanvas.height - margin - distance * distanceScale;
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, y);
    offscreenCtx.lineTo(10, y);
    offscreenCtx.strokeStyle = "black";
    offscreenCtx.lineWidth = 1;
    offscreenCtx.stroke();
    offscreenCtx.fillStyle = "black";
    offscreenCtx.font = "12px Arial";
    const textX = 15;
    let textY = (y < margin + 10) ? y + 10 : (y > offscreenCanvas.height - margin - 5) ? y - 5 : y + 3;
    offscreenCtx.fillText(`${distance}m`, textX, textY);
  }
  
  // Draw light states and intersection names
  let cumulativeDistance = 0;
  pathData.forEach((segment, index) => {
    const intersect = segment.intersection;
    const y = offscreenCanvas.height - margin - cumulativeDistance * distanceScale;
    
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, y);
    offscreenCtx.lineTo(offscreenCanvas.width, y);
    offscreenCtx.strokeStyle = "gray";
    offscreenCtx.lineWidth = 1;
    offscreenCtx.stroke();

    const intersectId = intersect.id || `intersect_${intersect.row}_${intersect.col}`;
    const states = trafficLightStates[intersectId] || [];
    
    const isFinalDestination = (selectedSpawnIndex === 'custom_path' && index === pathData.length - 1);

    states.forEach((state, idx) => {
        if (idx < states.length - 1) {
            const x1 = state.time / timeScale * timeScaleFactor;
            const x2 = states[idx + 1].time / timeScale * timeScaleFactor;
            
            let lightColor = 'red'; // 預設為紅燈

            if (isFinalDestination) {
                lightColor = 'green';
            } else {
                // 【核心修正】直接使用 movement 字串來檢查對應的燈號狀態
                // precomputeTrafficLightStates 已經為 'E', 'EL', 'ER' 等都產生了狀態
                if (state.state[segment.movement] === 'green') {
                    lightColor = 'green';
                }
            }
            
            offscreenCtx.beginPath();
            offscreenCtx.moveTo(x1, y);
            offscreenCtx.lineTo(x2, y);
            offscreenCtx.strokeStyle = lightColor;
            offscreenCtx.lineWidth = 2;
            offscreenCtx.stroke();
        }
    });
    
    // 顯示路口名稱 (程式碼不變)
    offscreenCtx.fillStyle = "black";
    offscreenCtx.font = "12px Arial";
    const textY = y + 12;
    if (textY < offscreenCanvas.height - margin) {
        let intersectionName = intersect.intersectionName?.trim();
        if (!intersectionName) {
            const row = intersect.row;
            const col = intersect.col;
            intersectionName = `(${row},${col})`;
        }
        offscreenCtx.fillText(intersectionName, 60, textY);
    }
    
    cumulativeDistance += segment.distanceToNext;
  });

  // Draw vehicle trajectories (程式碼不變)
  const spawnIdToMatch = (selectedSpawnIndex === 'custom_path' && customPath)
    ? `spawn_${simIntersections.findIndex(inter => inter.row === customPath[0].intersection.row && inter.col === customPath[0].intersection.col)}`
    : (spawnPointsList[selectedSpawnIndex] ? spawnPointsList[selectedSpawnIndex].id : null);

  if (spawnIdToMatch) {
      for (let vehId in vehicleTrajectories) {
        const trajectory = vehicleTrajectories[vehId];
        if (trajectory.length === 0 || trajectory[0].spawnId !== spawnIdToMatch) continue;
        offscreenCtx.beginPath();
        let firstPoint = true;
        trajectory.forEach(point => {
          const x = (point.time / timeScale) * timeScaleFactor;
          const y = offscreenCanvas.height - margin - point.position * distanceScale;
          if (y < margin || y > offscreenCanvas.height - margin) return;
          if (firstPoint) {
            offscreenCtx.moveTo(x, y);
            firstPoint = false;
          } else {
            offscreenCtx.lineTo(x, y);
          }
        });
        offscreenCtx.strokeStyle = "blue";
        offscreenCtx.lineWidth = 1;
        offscreenCtx.stroke();
      }
  }

  // Draw green wave paths (程式碼不變)
  const { paths: greenWavePaths, maxGreenWaveTime, totalGreenWaveTime } = computeGreenWavePaths();
  greenWavePaths.forEach(path => {
    const startX = (path.startTime / timeScale) * timeScaleFactor;
    const startY = offscreenCanvas.height - margin;
    const endTime = (path.startTime + path.endDistance / greenWaveSpeed) / timeScale;
    const endX = endTime * timeScaleFactor;
    const endY = offscreenCanvas.height - margin - path.endDistance * distanceScale;
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(startX, startY);
    offscreenCtx.lineTo(endX, endY);
    offscreenCtx.strokeStyle = "rgba(144, 238, 144, 0.1)";
    offscreenCtx.lineWidth = 1;
    offscreenCtx.stroke();
  });

  const probability = (totalGreenWaveTime / fixedSimulationDuration) * 100;
  const formattedProbability = isNaN(probability) ? 0 : probability;
  document.getElementById("maxGreenWaveTime").textContent = `最大綠波秒數：${maxGreenWaveTime.toFixed(1)} 秒 | 通過機率：${formattedProbability.toFixed(2)}%`;
}
/// 修正後的 animateSim 函數
function animateSim(timestamp) {
  if (!simLastTimeAnim) simLastTimeAnim = timestamp;
  simLastTimeAnim = timestamp;

  // 清空 simCanvas 並繪製模擬內容
  //sCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
  //drawSimNetwork();
  //drawSimSpawnPoints();
  //drawSimVehicles();

  // 更新離屏畫布並繪製到 spacetimeCanvas
  if (timestamp - lastSpacetimeUpdate >= SPACETIME_UPDATE_INTERVAL) {
    updateSpacetimeOffscreen(); // 更新離屏畫布
    stCtx.clearRect(0, 0, stCanvas.width, stCanvas.height); // 清空 spacetimeCanvas
    stCtx.drawImage(offscreenCanvas, 0, 0); // 將離屏畫布繪製到 spacetimeCanvas
    lastSpacetimeUpdate = timestamp;
  }

  requestAnimationFrame(animateSim);
}

// 啟動動畫
requestAnimationFrame(animateSim);		

document.getElementById("startSimBtn").addEventListener("click", function() {
  if (!simulationRunning) {
    //const userDuration = prompt("請輸入模擬時間區間（秒），預設為 300：", fixedSimulationDuration);
    //fixedSimulationDuration = userDuration && !isNaN(userDuration) ? parseFloat(userDuration) : 300;
	

    //const userSpeed = prompt("請輸入期望速度與綠波速度（km/h），預設為 36 km/h（即 10 m/s）：", 36);
    const vehicleSpeedInput = document.getElementById("vehicleSpeedInput");	
	const speedKmH = parseFloat(vehicleSpeedInput.value) || 50; // 若無效則預設 40 km/h
    greenWaveSpeed = speedKmH * (1000 / 3600);
    IDM_PARAMS.v0 = greenWaveSpeed;

    // 從選單獲取倍速
    const timeScaleSelector = document.getElementById("timeScaleSelector");
    timeScale = parseFloat(timeScaleSelector.value); // 從選單讀取倍率值

    simulationRunning = true;
    simulationStarted = true;
    simulationTime = 0;
    simStartTime = performance.now() / 1000;
    lastUpdateTime = simStartTime;
    simVehicles = [];
    simSpawnPoints.forEach(sp => sp.timer = 0);
    vehicleTrajectories = {};
    vehicleIdCounter = 0;
    simIntersections.forEach(intersect => {
		intersect.lightStatus = { N: 'red', S: 'red', E: 'red', W: 'red', NE: 'red', SW: 'red', SE: 'red', NW: 'red' };    });
    precomputeTrafficLightStates();
    updateSpacetimeOffscreen();

    simulationInterval = setInterval(updateSimulation, 1000 / 60);
  }
});

document.getElementById("stopSimBtn").addEventListener("click", function() {
  simulationRunning = false;
  simStartTime = null;
  lastUpdateTime = null; // 重置上次更新時間
  simVehicles = [];
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  alert("模擬已停止，燈號與車輛停止運作");
});

    document.getElementById("exportSpacetimeBtn").addEventListener("click", function() {
      const stCanvas = document.getElementById("spacetimeCanvas");
      const url = stCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "spacetime_diagram.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

function reFresh() {
  generateDesignNetwork();
  //const meterToPixel = 1;//5;
  const margin = 50;
  const laneGap = 10;
  const defaultHorizontalDistance = 100;
  const defaultVerticalDistance = 100;

  // 模擬區座標計算
  let rowY = [margin];
  for (let r = 1; r < GRID_ROWS; r++) {
    let distance = defaultVerticalDistance;
    for (let c = 0; c < GRID_COLS; c++) {
      let key = `${r - 1},${c}-${r},${c}`;
      if (roadDistances[key] && roadDistances[key].distance !== -1) {
        distance = roadDistances[key].distance;
        break;
      }
    }
    rowY.push(rowY[r - 1] + distance);
  }

  let rowColX = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    rowColX[r] = [margin];
    for (let c = 1; c < GRID_COLS; c++) {
      let key = `${r},${c - 1}-${r},${c}`;
      let distance = roadDistances[key] && roadDistances[key].distance !== -1
        ? roadDistances[key].distance
        : defaultHorizontalDistance;
      rowColX[r].push(rowColX[r][c - 1] + distance);
    }
  }

  simIntersections = gridCircles
    .filter(circle => circle.selected)
    .map(circle => {
      // Validate phases to prevent diagonal-horizontal conflicts
      const hasDiagonal = circle.phases.some(phase => 
        phase.activeDirections.some(dir => ['NE', 'SW', 'SE', 'NW'].includes(dir))
      );
      const hasHorizontal = circle.phases.some(phase => 
        phase.activeDirections.some(dir => ['E', 'W'].includes(dir))
      );

      if (hasDiagonal && hasHorizontal) {
        const phases = circle.phases.map((phase, index) => {
          if (phase.activeDirections.some(dir => ['NE', 'SW', 'SE', 'NW'].includes(dir))) {
            return {
              ...phase,
              activeDirections: phase.activeDirections.filter(dir => !['E', 'W'].includes(dir))
            };
          }
          return phase;
        });
        circle.phases = phases;
      }

      // 【修正點】在這裡返回的物件中，加入 row 和 col 屬性
      return {
        row: circle.row, // <-- 新增此行
        col: circle.col, // <-- 新增此行
        position: { x: rowColX[circle.row][circle.col], y: rowY[circle.row] },
        phases: circle.phases,
        offset: circle.offset,
        spawnPoint: {
          enabled: circle.spawnEnabled,
          frequency: circle.spawnFrequency,
          direction: circle.spawnDirection,
          spawnName: circle.spawnName
        },
        lightStatus: { 
          N: 'red', S: 'red', E: 'red', W: 'red', 
          NE: 'red', SW: 'red', SE: 'red', NW: 'red' 
        },
        id: `intersect_${circle.row}_${circle.col}`,
        intersectionName: circle.intersectionName
      };
    });

  simRoads = [];
  for (let key in roadDistances) {
    let [c1Row, c1Col, c2Row, c2Col] = key.split(/[,|-]/).map(Number);
    let c1 = gridCircles.find(c => c.row === c1Row && c.col === c1Col);
    let c2 = gridCircles.find(c => c.row === c2Row && c.col === c2Col);
    if (c1 && c2 && c1.selected && c2.selected) {
      let startPos = { x: rowColX[c1.row][c1.col], y: rowY[c1.row] };
      let endPos = { x: rowColX[c2.row][c2.col], y: rowY[c2.row] };
      let distance = roadDistances[key].distance === -1 ? 0 : roadDistances[key].distance;
      let orientation, direction;
      let lanePos, laneNeg;
      let visible = roadDistances[key].distance !== -1;

      if (c1.row === c2.row) {
        orientation = 'horizontal';
        direction = c2.col > c1.col ? 'E' : 'W';
        lanePos = startPos.y + laneGap / 2;
        laneNeg = startPos.y - laneGap / 2;
      } else if (c1.col === c2.col) {
        orientation = 'vertical';
        direction = c2.row > c1.row ? 'S' : 'N';
        lanePos = startPos.x + laneGap / 2;
        laneNeg = startPos.x - laneGap / 2;
      } else {
        orientation = 'diagonal';
        if (c2.col > c1.col && c2.row < c1.row) {
          direction = 'NE';
        } else if (c2.col < c1.col && c2.row > c1.row) {
          direction = 'SW';
        } else if (c2.col > c1.col && c2.row > c1.row) {
          direction = 'SE';
        } else if (c2.col < c1.col && c2.row < c1.row) {
          direction = 'NW';
        }

        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpDx = -dy / length * laneGap / 2;
        const perpDy = dx / length * laneGap / 2;

        if (['NE', 'SW'].includes(direction)) {
          lanePos = { x: startPos.x + perpDx, y: startPos.y + perpDy };
          laneNeg = { x: startPos.x - perpDx, y: startPos.y - perpDy };
        } else if (['SE', 'NW'].includes(direction)) {
          lanePos = { x: startPos.x - perpDx, y: startPos.y - perpDy };
          laneNeg = { x: startPos.x + perpDx, y: startPos.y + perpDy };
        }
      }

		simRoads.push({
		  orientation: orientation,
		  start: startPos,
		  end: endPos,
		  distance: distance,
		  direction: direction,
		  lanePositive: orientation === 'diagonal' ? lanePos : (orientation === 'horizontal' ? lanePos : lanePos),
		  laneNegative: orientation === 'diagonal' ? laneNeg : (orientation === 'horizontal' ? laneNeg : laneNeg),
		  name: roadDistances[key].name || '',
		  visible: roadDistances[key].distance !== -1
		});
    }
  }

	simRoads.forEach(road => {
	  if (road.orientation === 'diagonal') {
		console.log(`對角線道路: ${road.direction}, 起點: (${road.start.x}, ${road.start.y}), 終點: (${road.end.x}, ${road.end.y})`);
	  }
	});

  // 更新設計區（固定間距）
  drawDesignGrid();
  generateSimSpawnPoints();  
  precomputeTrafficLightStates();
  updateSpacetimeOffscreen();
  renderSpawnDataDisplay();
}

document.getElementById("exportJsonBtn").addEventListener("click", function() {
  const exportData = {
    gridCircles: gridCircles.map(circle => ({
      row: circle.row,
      col: circle.col,
      x: circle.x,
      y: circle.y,
      selected: circle.selected,
      phases: circle.phases.map(phase => ({
        activeDirections: phase.activeDirections,
        leftTurnDirections: phase.leftTurnDirections || [], // 確保左轉方向，若無則導出空陣列
        rightTurnDirections: phase.rightTurnDirections || [], // 新增：右轉方向，若無則導出空陣列
        greenTime: phase.greenTime,
        redTime: phase.redTime
      })),
      offset: circle.offset,
      spawnEnabled: circle.spawnEnabled,
      spawnFrequency: circle.spawnFrequency,
      spawnDirection: circle.spawnDirection,
      spawnName: circle.spawnName,
      locked: circle.locked,
      isMaster: circle.isMaster,
      masterName: circle.masterName,
      refMaster: circle.refMaster,
      intersectionName: circle.intersectionName
    })),
    roadDistances: roadDistances
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "road_network.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("importJsonInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      gridCircles = data.gridCircles.map(circle => ({
        row: circle.row,
        col: circle.col,
        x: circle.x,
        y: circle.y,
        selected: circle.selected || false,
        phases: circle.phases.map(phase => ({
          activeDirections: phase.activeDirections || [],
          leftTurnDirections: phase.leftTurnDirections || [],
          rightTurnDirections: phase.rightTurnDirections || [], // 新增：右轉方向，若無則導入空陣列
          greenTime: phase.greenTime || 10,
          redTime: phase.redTime || 1
        })),
        offset: circle.offset || 0,
        spawnEnabled: circle.spawnEnabled || false,
        spawnFrequency: circle.spawnFrequency || 5,
        spawnDirection: circle.spawnDirection || "E",
        spawnName: circle.spawnName || "",
        locked: circle.locked || false,
        isMaster: circle.isMaster || false,
        masterName: circle.masterName || "",
        refMaster: circle.refMaster || null,
        intersectionName: circle.intersectionName || ""
      }));
      roadDistances = data.roadDistances || {};

      // 更新 UI
      drawDesignGrid();
      if (selectedCircle) {
        const isSpawn = selectedCircle.spawnEnabled;
        const phaseCount = selectedCircle.phases.length;
        document.getElementById("phaseCount").value = phaseCount;
        document.getElementById("isSpawn").checked = isSpawn;
        document.getElementById("spawnDirection").value = selectedCircle.spawnDirection || "E";
        document.getElementById("intersectionName").value = selectedCircle.intersectionName || "";
        document.getElementById("lockCircle").checked = selectedCircle.locked;
        document.getElementById("isMaster").checked = selectedCircle.isMaster;
        document.getElementById("masterName").value = selectedCircle.masterName || "";
        document.getElementById("masterName").disabled = !selectedCircle.isMaster;
        document.getElementById("refMaster").value = selectedCircle.refMaster || "";
        document.getElementById("refMaster").disabled = selectedCircle.isMaster;
        document.getElementById("offsetInput").value = selectedCircle.offset || 0;
        document.getElementById("spawnFrequencyInput").value = selectedCircle.spawnFrequency || 5;
        document.getElementById("phaseCount").disabled = isSpawn;
        renderPhases(phaseCount, selectedCircle.phases, isSpawn, selectedCircle.spawnDirection);
        updateCycleTimeDisplay(selectedCircle);
      }
      updateSpawnPointSelector();
      reFresh();
	  alert(`成功導入路網數據！`);
    } catch (err) {
      alert("JSON 檔案格式錯誤：" + err.message);
    }
  };
  reader.readAsText(file);
});
	
///////////////////////////////////////////////////////////
let simulationTime = 0; // 新增：模擬時間
let simStartTime = null; // 新增：模擬開始時間基準 	
 

function updateSimulation() {
  if (!simulationRunning) return;

  const currentTime = performance.now() / 1000;
  const baseDt = lastUpdateTime === null ? 0 : (currentTime - lastUpdateTime);
  lastUpdateTime = currentTime;

  const maxDt = 0.01667;
  const scaledDt = baseDt * timeScale;
  const steps = Math.ceil(scaledDt / maxDt);
  const subDt = scaledDt / steps;

  for (let i = 0; i < steps; i++) {
    simulationTime += subDt;
    if (simulationTime > fixedSimulationDuration) {
      simulationTime = fixedSimulationDuration;
      simulationRunning = false;
      clearInterval(simulationInterval);
      simulationInterval = null;
      break;
    }

    updateTrafficLights();
    // 驗證燈號狀態
    simIntersections.forEach(inter => {
      console.log(`路口 ${inter.id} 在 t=${simulationTime.toFixed(2)}s: ${JSON.stringify(inter.lightStatus)}`);
    });
    updateSimSpawnPoints(subDt);
    updateSimVehicles(subDt);
  }
}

function updateTrafficLights() {
  if (simStartTime === null) return;

  simIntersections.forEach(intersect => {
    const cycle = intersect.phases.reduce((sum, p) => sum + p.greenTime + p.redTime, 0);
    let elapsedTime = (simulationTime - intersect.offset) % cycle;
    if (elapsedTime < 0) elapsedTime += cycle;
    let timeElapsed = 0;

    intersect.lightStatus = { 
      N: 'red', S: 'red', E: 'red', W: 'red', 
      NE: 'red', SW: 'red', SE: 'red', NW: 'red' 
    };

    for (let i = 0; i < intersect.phases.length; i++) {
      const phase = intersect.phases[i];
      const phaseDuration = phase.greenTime + phase.redTime;

      if (elapsedTime >= timeElapsed && elapsedTime < timeElapsed + phaseDuration) {
        const inGreen = elapsedTime < timeElapsed + phase.greenTime;
        const nextPhaseIndex = (i + 1) % intersect.phases.length;
        const nextPhase = intersect.phases[nextPhaseIndex];

        if (inGreen) {
          phase.activeDirections.forEach(dir => {
            intersect.lightStatus[dir] = 'green';
          });
        } else {
          phase.activeDirections.forEach(dir => {
            if (nextPhase.activeDirections.includes(dir)) {
              intersect.lightStatus[dir] = 'green';
            }
          });
        }
        break;
      }
      timeElapsed += phaseDuration;
    }

    // 驗證對角線方向的燈號狀態
    const diagonalDirs = ['NE', 'SW', 'SE', 'NW'];
    const hasDiagonalGreen = diagonalDirs.some(dir => intersect.lightStatus[dir] === 'green');
    if (hasDiagonalGreen) {
      console.log(`路口 ${intersect.id} 在 t=${simulationTime.toFixed(2)}s 有對角線綠燈: ${JSON.stringify(intersect.lightStatus)}`);
    }
  });
}

let simVehicles = []; // 新增：儲存車輛的陣列
let vehicleTrajectories = {}; // 儲存車輛軌跡，key 為車輛 ID
let vehicleIdCounter = 0; // 車輛 ID 計數器
//const VEHICLE_SPEED = 10; // 車輛速度，10 公尺/秒

// 更新生成點，生成車輛
function updateSimSpawnPoints(dt) {
  simSpawnPoints.forEach(sp => {
    sp.timer += dt; // 使用固定的 dt
    if (sp.timer >= sp.spawnFrequency) {
      spawnSimVehicle(sp);
      sp.timer = 0;
    }
  });
}

// 生成單輛車
function spawnSimVehicle(sp) {
  if (sp.type === 'intersection') {
    const direction = sp.intersection.spawnPoint.direction;
    const roads = continuousRoadsBySpawn[sp.id];
    if (!roads || roads.length === 0) return;

    const totalDistance = roads.reduce((sum, road) => sum + road.distance, 0);

    const veh = {
      position: 0,
      velocity: 0,
      acceleration: 0,
      roads: roads,
      direction: direction,
      totalDistance: totalDistance,
      currentRoadIndex: 0,
      length: 5,
      id: vehicleIdCounter++,
      spawnId: sp.id // 新增 spawnId 屬性
    };
    simVehicles.push(veh);
    vehicleTrajectories[veh.id] = [];
  }
}

function updateSimVehicles(dt) {
  simVehicles.forEach(veh => {
    let cumulativeDistance = 0;
    let currentRoad = veh.roads[veh.currentRoadIndex];
    
    // 計算當前道路的累計距離
    for (let i = 0; i < veh.currentRoadIndex; i++) {
      cumulativeDistance += veh.roads[i].distance;
    }
    const relativePosition = veh.position - cumulativeDistance;

    // 尋找前車
    let leadVeh = null;
    simVehicles.forEach(other => {
      if (veh === other) return;
      if (other.roads === veh.roads && other.direction === veh.direction && other.position > veh.position) {
        if (!leadVeh || other.position < leadVeh.position) {
          leadVeh = other;
        }
      }
    });

    // 檢測下一個路口及紅燈
    const nextIntersect = simIntersections.find(inter => 
      Math.abs(inter.position.x - currentRoad.end.x) < 5 &&
      Math.abs(inter.position.y - currentRoad.end.y) < 5
    );
    let redLightDist = Infinity;
	// 檢測下一個路口     let redLightDist = Infinity;
	if (nextIntersect) {
	  const distanceToIntersect = currentRoad.distance - relativePosition;
	  // 動態計算停止閾值：考慮速度和時間步進
	  const stopThreshold = Math.max(2, veh.velocity * dt * 2); // 至少 2m，或速度*步進*2
	  const lightStatus = nextIntersect.lightStatus[veh.direction];
	  if (distanceToIntersect <= stopThreshold && lightStatus === 'red') {
		redLightDist = distanceToIntersect;
	  }
	}

    // 紅燈時設置虛擬領先車輛
    if (redLightDist < Infinity) {
      // 修復 2：移除 veh.length，確保停止點在路口
      const virtualLeader = { position: veh.position + redLightDist, velocity: 0, length: 0 };
      if (!leadVeh || virtualLeader.position < leadVeh.position) {
        leadVeh = virtualLeader;
      }

      // 修復 4：當車輛過於靠近路口且紅燈時，強制停止
      if (redLightDist <= IDM_PARAMS.s0 && nextIntersect.lightStatus[veh.direction] === 'red') {
        veh.velocity = 0;
        veh.acceleration = 0;
        veh.position = cumulativeDistance + currentRoad.distance - IDM_PARAMS.s0;
      }
    }

    // 計算 IDM 加速度
    veh.acceleration = calculateIDM(veh, leadVeh);

    // 更新速度和位置
    veh.velocity += veh.acceleration * dt;
    if (veh.velocity < 0) veh.velocity = 0;
    if (veh.velocity > IDM_PARAMS.v0) veh.velocity = IDM_PARAMS.v0;
    veh.position += veh.velocity * dt;

    // 修復 3：限制位置不超過路口（紅燈時）
	// 修復：紅燈時嚴格限制位置
	if (redLightDist < Infinity && nextIntersect.lightStatus[veh.direction] === 'red') {
	  const maxPosition = cumulativeDistance + currentRoad.distance;
	  if (veh.position > maxPosition) {
		console.warn(`車輛 ${veh.id} 嘗試穿越紅燈，位置從 ${veh.position.toFixed(2)} 修正到 ${maxPosition.toFixed(2)}`);
		veh.position = maxPosition;
		veh.velocity = 0;
	  }
	}

    // 記錄軌跡
    vehicleTrajectories[veh.id].push({
      time: simulationTime,
      position: veh.position,
      direction: veh.direction,
      spawnId: veh.spawnId
    });

    // 更新當前道路索引
    cumulativeDistance = 0;
    for (let i = 0; i < veh.roads.length; i++) {
      const road = veh.roads[i];
      if (veh.position < cumulativeDistance + road.distance) {
        veh.currentRoadIndex = i;
        break;
      }
      cumulativeDistance += road.distance;
    }

    // 檢查車輛是否到達終點
    if (veh.position >= veh.totalDistance) {
      veh._remove = true; // 標記移除，但保留軌跡
    }
  });

	// 排序車輛並防止碰撞
	simVehicles.sort((a, b) => a.position - b.position);
	for (let i = 0; i < simVehicles.length - 1; i++) {
	  const follower = simVehicles[i];
	  const leader = simVehicles[i + 1];
	  if (follower.roads === leader.roads && follower.direction === leader.direction) {
		const minGap = follower.length + IDM_PARAMS.s0;
		const nextIntersect = simIntersections.find(inter => 
		  Math.abs(inter.position.x - follower.roads[follower.currentRoadIndex].end.x) < 5 &&
		  Math.abs(inter.position.y - follower.roads[follower.currentRoadIndex].end.y) < 5
		);
		const isLeaderStoppedAtRed = nextIntersect && 
									nextIntersect.lightStatus[leader.direction] === 'red' && 
									Math.abs(leader.position - (cumulativeDistance + follower.roads[follower.currentRoadIndex].distance)) < IDM_PARAMS.s0;
		if (leader.position - follower.position < minGap && !isLeaderStoppedAtRed) {
		  follower.position = leader.position - minGap;
		  follower.velocity = Math.min(follower.velocity, leader.velocity);
		} else if (isLeaderStoppedAtRed) {
		  follower.velocity = 0; // 前車因紅燈停止，後車僅限速，不調整位置
		}
	  }
	}

  // 移除已完成的車輛
  simVehicles = simVehicles.filter(veh => !veh._remove);
}

// 計算車輛在模擬區的顯示位置
function getSimVehiclePos(veh) {
  let cumulativeDistance = 0; // 公尺
  let currentRoad = null;

  for (let i = 0; i < veh.roads.length; i++) {
    const road = veh.roads[i];
    const nextCumulativeDistance = cumulativeDistance + road.distance;
    if (veh.position < nextCumulativeDistance || i === veh.roads.length - 1) {
      currentRoad = road;
      veh.currentRoadIndex = i;
      break;
    }
    cumulativeDistance = nextCumulativeDistance;
  }

  if (!currentRoad) return { x: 0, y: 0 };

  const relativePosition = veh.position - cumulativeDistance; // 公尺
  const ratio = relativePosition / currentRoad.distance;
  const startPos = currentRoad.start;
  const endPos = currentRoad.end;
  let x = startPos.x + (endPos.x - startPos.x) * ratio; // 像素
  let y = startPos.y + (endPos.y - startPos.y) * ratio; // 像素

  if (currentRoad.orientation === 'horizontal') {
    y = (veh.direction === 'E') ? currentRoad.lanePositive : currentRoad.laneNegative;
  } else {
    x = (veh.direction === 'N') ? currentRoad.lanePositive : currentRoad.laneNegative;
  }

  return { x, y };
}



let timeScale = 1; // 時間加速因子，預設 1 倍速
let simulationInterval = null;
let lastUpdateTime = null; // 上次模擬更新的時間（秒）
//const METER_TO_PIXEL = 1; //5; // 1 公尺 = 5 像素
const VEHICLE_SPEED = 10; // 期望速度，10 m/s
const IDM_PARAMS = {
  v0: greenWaveSpeed, // 期望速度，初始為 10 m/s，後由使用者輸入更新
  T: 2, // 期望時間間距，秒
  a: 1.5, // 最大加速度，m/s²
  b: 2.0, // 舒適減速度，m/s²
  s0: 2 // 最小靜止間距，公尺
};

function calculateIDM(veh, leadVeh = null) {
  const { v0, T, a, b, s0 } = IDM_PARAMS;
  const v = veh.velocity; // m/s

  if (leadVeh) {
    const s = leadVeh.position - veh.position - leadVeh.length; // 淨間距，公尺
    const deltaV = v - leadVeh.velocity; // 速度差，m/s
    const sStar = s0 + Math.max(0, v * T + (v * deltaV) / (2 * Math.sqrt(a * b))); // 期望間距，公尺
    if (s <= 0) return -b; // 避免碰撞，減速 m/s²
    return a * (1 - Math.pow(v / v0, 4) - Math.pow(sStar / s, 2)); // 加速度，m/s²
  }
  return a * (1 - Math.pow(v / v0, 4)); // 無前車時，加速度 m/s²
}

document.getElementById("vehicleSpeedInput").addEventListener("change", function() {
  const speedKmH = parseFloat(this.value) || 50; // 若無效則預設 40 km/h
  greenWaveSpeed = speedKmH * (1000 / 3600); // 更新綠波速度
  IDM_PARAMS.v0 = greenWaveSpeed; // 更新車流模擬速度
  precomputeTrafficLightStates(); // 重新計算燈號狀態
  updateSpacetimeOffscreen(); // 更新時空圖
});

function showLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "block";
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "none";
}

function updateLoadingText(text) {
  document.getElementById("loadingText").textContent = text;
}

function updateLoadingProgress(value) {
  document.getElementById("loadingProgress").value = value; // 更新進度條（0-100）
}

// 確保離屏畫布大小與時空圖畫布一致（在窗口大小改變時更新）
function setCanvasSize() {
  const simPanel = document.getElementById("simPanel");
  const computedStyle = window.getComputedStyle(simPanel);
  const panelWidth = simPanel.offsetWidth -
                    parseFloat(computedStyle.paddingLeft) -
                    parseFloat(computedStyle.paddingRight);
  const canvasStyle = window.getComputedStyle(stCanvas);
  const cssWidth = panelWidth;
  const cssHeight = parseFloat(canvasStyle.height) || stCanvas.height;

  stCanvas.width = cssWidth;
  stCanvas.height = cssHeight;
  offscreenCanvas.width = cssWidth;  // 同步離屏畫布大小
  offscreenCanvas.height = cssHeight;
  updateSpacetimeOffscreen(); // 重新繪製離屏畫布
}

document.addEventListener("DOMContentLoaded", setCanvasSize);
window.addEventListener("resize", setCanvasSize);


const importJsonBtn = document.getElementById("importJsonBtn");
const importJsonInput = document.getElementById("importJsonInput");

importJsonBtn.addEventListener("click", () => {
	importJsonInput.click();
});
  
  
document.getElementById("exportTrajectoriesBtn").addEventListener("click", function() {
  if (Object.keys(vehicleTrajectories).length === 0) {
    alert("目前沒有軌跡數據可匯出！");
    return;
  }

  const jsonData = JSON.stringify(vehicleTrajectories, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vehicle_trajectories.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("軌跡數據已匯出為 JSON");
});

document.getElementById("importTrajectoriesBtn").addEventListener("click", function() {
  document.getElementById("importTrajectoriesInput").click();
});

document.getElementById("importTrajectoriesInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedTrajectories = JSON.parse(event.target.result);
      // 驗證匯入數據格式
      if (!isValidTrajectories(importedTrajectories)) {
        alert("匯入的 JSON 格式無效，請檢查檔案內容！");
        return;
      }

      // 更新全局變數
      vehicleTrajectories = importedTrajectories;
      updateSpacetimeOffscreen(); // 更新時空圖以反映匯入的軌跡
      console.log("軌跡數據已匯入：", vehicleTrajectories);
      alert("軌跡數據已成功匯入！");
    } catch (error) {
      console.error("匯入軌跡數據失敗：", error);
      alert("匯入失敗，請確認檔案為有效的 JSON 格式！");
    }
  };
  reader.readAsText(file);
  e.target.value = ""; // 重置輸入框，以便重複選擇同一檔案
});

// 驗證匯入的軌跡數據格式
function isValidTrajectories(data) {
  if (!data || typeof data !== "object") return false;
  return Object.values(data).every(trajectory => 
    Array.isArray(trajectory) && trajectory.every(point => 
      typeof point.time === "number" &&
      typeof point.position === "number" &&
      typeof point.direction === "string" &&
      typeof point.spawnId === "string"
    )
  );
}


document.getElementById("statsBtn").addEventListener("click", function() {
  if (Object.keys(vehicleTrajectories).length === 0) {
	alert("目前沒有軌跡數據可統計！");
	return;
  }

  // 按生成點統計平均速度、停等次數、停等秒數和行進中速度
  const statsBySpawn = calculateStatsBySpawn();
  displayStats(statsBySpawn);
});

// 計算每個生成點的統計數據 (單位為 km/h 和秒)
function calculateStatsBySpawn() {
  const statsBySpawn = {};
  const selector = document.getElementById("spawnPointSelector");
  const options = Array.from(selector.options);

  for (let vehId in vehicleTrajectories) {
    const trajectory = vehicleTrajectories[vehId];
    if (trajectory.length < 2) continue;

    const spawnId = trajectory[0].spawnId;
    const spawnPoint = spawnPointsList.find(sp => sp.id === spawnId);

    let key = spawnPoint 
      ? (options.find(opt => opt.value === spawnPointsList.indexOf(spawnPoint).toString())?.textContent || `${spawnPoint.name || "未知路口"} (${spawnPoint.direction || "未知方向"})`)
      : `${spawnId} (未知方向)`;

    if (!statsBySpawn[key]) {
      statsBySpawn[key] = {
        totalSpeed: 0,
        speedCount: 0,
        totalMovingSpeed: 0,
        movingSpeedCount: 0,
        totalStops: 0,
        totalStopTime: 0,
        vehicleCount: 0,
        redLightViolations: 0 // 新增：紅燈穿越次數
      };
    }

    let wasStopped = false;
    let stopStartTime = null;
    statsBySpawn[key].vehicleCount += 1;

    let prevIntersect = null;
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1];
      const curr = trajectory[i];
      if (prev.position <= 0 || curr.position <= 0) continue;

      const distance = curr.position - prev.position;
      const timeDiff = curr.time - prev.time;
      if (timeDiff <= 0) continue;

      const speedMs = distance / timeDiff;
      const speedKmh = speedMs * 3.6;

      statsBySpawn[key].totalSpeed += speedKmh;
      statsBySpawn[key].speedCount += 1;
      if (speedMs > 0) {
        statsBySpawn[key].totalMovingSpeed += speedKmh;
        statsBySpawn[key].movingSpeedCount += 1;
      }

      if (speedMs === 0) {
        if (!wasStopped) {
          statsBySpawn[key].totalStops += 1;
          stopStartTime = prev.time;
        }
        wasStopped = true;
      } else {
        if (wasStopped) {
          const stopEndTime = curr.time;
          statsBySpawn[key].totalStopTime += stopEndTime - stopStartTime;
        }
        wasStopped = false;
        stopStartTime = null;
      }

      // 檢查紅燈穿越
      const roads = continuousRoadsBySpawn[spawnId] || [];
      let cumulativeDistance = 0;
      let currentRoadIndex = 0;
      for (let j = 0; j < roads.length; j++) {
        if (curr.position < cumulativeDistance + roads[j].distance) {
          currentRoadIndex = j;
          break;
        }
        cumulativeDistance += roads[j].distance;
      }
      const currentRoad = roads[currentRoadIndex];
      const nextIntersect = simIntersections.find(inter => 
        Math.abs(inter.position.x - currentRoad.end.x) < 5 &&
        Math.abs(inter.position.y - currentRoad.end.y) < 5
      );
      if (nextIntersect && nextIntersect !== prevIntersect) {
        const distanceToIntersect = currentRoad.distance - (curr.position - cumulativeDistance);
        if (distanceToIntersect < 0 && nextIntersect.lightStatus[trajectory[0].direction] === 'red') {
          statsBySpawn[key].redLightViolations += 1;
          console.warn(`車輛 ${vehId} 在路口 ${nextIntersect.id} 紅燈穿越`);
        }
        prevIntersect = nextIntersect;
      }
    }

    if (wasStopped && stopStartTime !== null) {
      const stopEndTime = trajectory[trajectory.length - 1].time;
      statsBySpawn[key].totalStopTime += stopEndTime - stopStartTime;
    }
  }

  for (let key in statsBySpawn) {
    if (statsBySpawn[key].speedCount > 0) {
      statsBySpawn[key].averageSpeed = statsBySpawn[key].totalSpeed / statsBySpawn[key].speedCount;
    } else {
      statsBySpawn[key].averageSpeed = 0;
    }
    if (statsBySpawn[key].movingSpeedCount > 0) {
      statsBySpawn[key].averageMovingSpeed = statsBySpawn[key].totalMovingSpeed / statsBySpawn[key].movingSpeedCount;
    } else {
      statsBySpawn[key].averageMovingSpeed = 0;
    }
    if (statsBySpawn[key].vehicleCount > 0) {
      statsBySpawn[key].averageStops = statsBySpawn[key].totalStops / statsBySpawn[key].vehicleCount;
      statsBySpawn[key].averageStopTime = statsBySpawn[key].totalStopTime / statsBySpawn[key].vehicleCount;
      statsBySpawn[key].averageRedLightViolations = statsBySpawn[key].redLightViolations / statsBySpawn[key].vehicleCount;
    } else {
      statsBySpawn[key].averageStops = 0;
      statsBySpawn[key].averageStopTime = 0;
      statsBySpawn[key].averageRedLightViolations = 0;
    }
  }

  return statsBySpawn;
}

function displayStats(statsBySpawn) {
  const statsDiv = document.getElementById("speedStats");
  statsDiv.innerHTML = "<h3>各生成點統計</h3>";

  const ul = document.createElement("ul");
  for (let key in statsBySpawn) {
    const avgSpeed = statsBySpawn[key].averageSpeed.toFixed(2);
    const avgMovingSpeed = statsBySpawn[key].averageMovingSpeed.toFixed(2);
    const avgStops = statsBySpawn[key].averageStops.toFixed(2);
    const avgStopTime = statsBySpawn[key].averageStopTime.toFixed(2);
    const avgRedLightViolations = statsBySpawn[key].averageRedLightViolations.toFixed(2);
    const li = document.createElement("li");
    li.textContent = `${key}: 總平均速度 ${avgSpeed} km/h, 行進中平均速度 ${avgMovingSpeed} km/h, 平均停等次數 ${avgStops} 次, 平均停等秒數 ${avgStopTime} 秒, 平均紅燈穿越次數 ${avgRedLightViolations} 次`;
    ul.appendChild(li);
  }

  if (Object.keys(statsBySpawn).length === 0) {
    statsDiv.innerHTML += "<p>無有效統計數據</p>";
  } else {
    statsDiv.appendChild(ul);
  }
}

// 定義獨立函數 minimizeSettingsPanel
function minimizeSettingsPanel(settingsPanel, minimizedIcon, currentX, currentY) {
  // 計算目標位置（左下角）
  const targetX = 20; // 與 #minimizedIcon 的 left: 20px 一致
  const targetY = window.innerHeight - minimizedIcon.offsetHeight - 20; // 與 bottom: 20px 一致

  // 動畫：縮小並移動到左下角
  settingsPanel.style.transform = `translate(${targetX - currentX}px, ${targetY - currentY}px) scale(0.1)`;
  settingsPanel.style.opacity = "0";

  // 0.5秒後隱藏並顯示縮小圖示
  setTimeout(() => {
    settingsPanel.style.display = "none";
    settingsPanel.style.transform = "none"; // 重置變形
    settingsPanel.style.opacity = "1"; // 重置透明度
    minimizedIcon.style.display = "block";
    minimizedIcon.style.opacity = "1"; // 淡入
  }, 500); // 與 CSS 過渡時間一致
}

// 定義獨立函數 restoreSettingsPanel
function restoreSettingsPanel(settingsPanel, minimizedIcon, panelContent, currentX, currentY) {
  minimizedIcon.style.opacity = "0"; // 淡出
  setTimeout(() => {
    minimizedIcon.style.display = "none";
    settingsPanel.style.display = "flex";
    // 從左下角放大回原位置
    settingsPanel.style.transform = "scale(0.1)";
    settingsPanel.style.opacity = "0";
    settingsPanel.style.left = `${currentX}px`;
    settingsPanel.style.top = `${currentY}px`;
    setTimeout(() => {
      settingsPanel.style.transform = "scale(1)";
      settingsPanel.style.opacity = "1";
      panelContent.style.overflowY = "auto"; // 確保滾動條顯示
    }, 10); // 短暫延遲以觸發動畫
  }, 50); // 確保淡出完成
}


/**
 * 填充路徑起點和終點的下拉選擇器
 */
function populatePathSelectors() {
  const startSelector = document.getElementById("pathStartPointSelector");
  const endSelector = document.getElementById("pathEndPointSelector");

  // 保存當前選擇
  const currentStart = startSelector.value;
  const currentEnd = endSelector.value;

  // 清空選項
  startSelector.innerHTML = '<option value="">無</option>';
  endSelector.innerHTML = '<option value="">無</option>';

  spawnPointsList.forEach((sp) => {
    const circle = sp.intersection;
    // 使用 row,col 作為唯一標識符
    const value = `${circle.row},${circle.col}`;
    
    const intersectionName = circle.intersectionName?.trim();
    let displayName;
    if (intersectionName) {
      displayName = intersectionName;
    } else {
      displayName = `(${circle.row},${circle.col})`;
    }
    const text = `${displayName} - 方向: ${circle.spawnPoint.direction}`;

    const startOption = new Option(text, value);
    const endOption = new Option(text, value);

    startSelector.add(startOption);
    endSelector.add(endOption);
  });
  
  // 恢復之前的選擇
  startSelector.value = currentStart;
  endSelector.value = currentEnd;
}


/**
 * 處理路徑起點或終點選擇變更的事件
 */
function handlePathSelectionChange() {
  const startValue = document.getElementById("pathStartPointSelector").value;
  const endValue = document.getElementById("pathEndPointSelector").value;

  if (startValue && endValue && startValue !== endValue) {
    const [startRow, startCol] = startValue.split(',').map(Number);
    const [endRow, endCol] = endValue.split(',').map(Number);
    
    const startNode = gridCircles.find(c => c.row === startRow && c.col === startCol);
    const endNode = gridCircles.find(c => c.row === endRow && c.col === endCol);

    if (startNode && endNode) {
      customPath = findShortestPath(startNode, endNode);
      if (!customPath) {
        alert("找不到從起點到終點的路徑！");
      }
    } else {
      customPath = null;
    }
  } else {
    customPath = null;
  }
  
  updateSpawnPointSelector();
  
  // 如果 "路徑" 選項存在，自動選中它
  const spawnSelector = document.getElementById("spawnPointSelector");
  if (customPath && Array.from(spawnSelector.options).some(opt => opt.value === 'custom_path')) {
      spawnSelector.value = 'custom_path';
      // 手動觸發 change 事件以更新時空圖
      spawnSelector.dispatchEvent(new Event('change'));
  }
}

/**
 * 使用 Dijkstra 演算法尋找最短路徑
 * @param {object} startNode - 起點 gridCircle
 * @param {object} endNode - 終點 gridCircle
 * @returns {Array|null} - 路徑陣列或 null
 */
function findShortestPath(startNode, endNode) {
  const nodes = gridCircles.filter(c => c.selected);
  if (!nodes.includes(startNode) || !nodes.includes(endNode)) return null;

  const distances = new Map();
  const previous = new Map();
  const pq = new Set();

  nodes.forEach(node => {
    distances.set(node, Infinity);
    previous.set(node, null);
    pq.add(node);
  });

  distances.set(startNode, 0);

  while (pq.size > 0) {
    let closestNode = null;
    let minDistance = Infinity;
    for (const node of pq) {
      if (distances.get(node) < minDistance) {
        minDistance = distances.get(node);
        closestNode = node;
      }
    }
    
    if (closestNode === null || closestNode === endNode) break;
    
    pq.delete(closestNode);

    const neighbors = getNeighbors(closestNode);
    for (const { neighbor, distance } of neighbors) {
      if (pq.has(neighbor)) {
        const alt = distances.get(closestNode) + distance;
        if (alt < distances.get(neighbor)) {
          distances.set(neighbor, alt);
          previous.set(neighbor, closestNode);
        }
      }
    }
  }

  const path = [];
  let currentNode = endNode;
  while (currentNode) {
    path.unshift(currentNode);
    currentNode = previous.get(currentNode);
  }

  if (path[0] !== startNode) return null; // 未找到路徑

  // 計算每個路口的行進方向
  const detailedPath = [];
  for (let i = 0; i < path.length; i++) {
    const prev = i > 0 ? path[i - 1] : null;
    const current = path[i];
    const next = i < path.length - 1 ? path[i + 1] : null;
    
    const movement = getMovementAtIntersection(prev, current, next);
    const distToNext = next ? (roadDistances[`${current.row},${current.col}-${next.row},${next.col}`] || roadDistances[`${next.row},${next.col}-${current.row},${current.col}`])?.distance || 0 : 0;

    detailedPath.push({
      intersection: current,
      movement: movement,
      distanceToNext: distToNext
    });
  }
  
  return detailedPath;
}

/**
 * 獲取一個節點的所有鄰居及其距離
 * @param {object} node - gridCircle 節點
 * @returns {Array} - 鄰居節點和距離的陣列
 */
function getNeighbors(node) {
    const neighbors = [];
    for (const key in roadDistances) {
        if (roadDistances[key].distance === -1) continue;

        const [r1, c1, r2, c2] = key.split(/[,|-]/).map(Number);
        
        if (r1 === node.row && c1 === node.col) {
            const neighborNode = gridCircles.find(c => c.row === r2 && c.col === c2);
            if (neighborNode && neighborNode.selected) {
                neighbors.push({ neighbor: neighborNode, distance: roadDistances[key].distance });
            }
        } else if (r2 === node.row && c2 === node.col) {
            const neighborNode = gridCircles.find(c => c.row === r1 && c.col === c1);
            if (neighborNode && neighborNode.selected) {
                neighbors.push({ neighbor: neighborNode, distance: roadDistances[key].distance });
            }
        }
    }
    return neighbors;
}

/**
 * 根據前、中、後三個路口，判斷在中路口的行進方向（直行、左轉、右轉）
 * @param {object|null} prev - 前一個 gridCircle
 * @param {object} current - 當前 gridCircle
 * @param {object|null} next - 下一個 gridCircle
 * @returns {string} - 行進方向代碼 (e.g., 'E', 'NL', 'ER')
 */
function getMovementAtIntersection(prev, current, next) {
    if (!next) return 'END'; // 終點
    if (!prev) { // 起點
        const dr = next.row - current.row;
        const dc = next.col - current.col;
        if (dr === -1 && dc === 0) return 'N';
        if (dr === 1 && dc === 0) return 'S';
        if (dr === 0 && dc === 1) return 'E';
        if (dr === 0 && dc === -1) return 'W';
        if (dr === -1 && dc === 1) return 'NE';
        if (dr === 1 && dc === -1) return 'SW';
        if (dr === 1 && dc === 1) return 'SE';
        if (dr === -1 && dc === -1) return 'NW';
        return 'E'; // 預設
    }

    const in_dr = current.row - prev.row;
    const in_dc = current.col - prev.col;
    const out_dr = next.row - current.row;
    const out_dc = next.col - current.col;
    
    const dirMap = {
        '-1,0': 'N', '1,0': 'S', '0,1': 'E', '0,-1': 'W',
        '-1,1': 'NE', '1,-1': 'SW', '1,1': 'SE', '-1,-1': 'NW'
    };
    
    const inDir = dirMap[`${in_dr},${in_dc}`];
    const outDir = dirMap[`${out_dr},${out_dc}`];

    if (inDir === outDir) return outDir; // 直行

    // 判斷轉向
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const inIndex = dirs.indexOf(inDir);
    const outIndex = dirs.indexOf(outDir);
    
    let diff = outIndex - inIndex;
    if (diff > 4) diff -= 8;
    if (diff < -4) diff += 8;
    
    if (diff === 2 || diff === -6) return inDir + 'R'; // 右轉 (順時針差2)
    if (diff === -2 || diff === 6) return inDir + 'L'; // 左轉 (逆時針差2)

    return outDir; // 其他非標準轉向，視為直行
}
