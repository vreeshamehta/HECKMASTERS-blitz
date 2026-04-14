let transactions = [];
let strategy = "fast";
let chart;

// Mock Dataset (on API fallback)
const MOCK_EXPENSES = [
  { id: 1,  from: "Alice",   amount: 120.00, to: ["Alice","Bob","Carol","Dave"] },
  { id: 2,  from: "Bob",     amount: 45.50,  to: ["Bob","Carol"]},
  { id: 3,  from: "Carol",   amount: 80.00,  to: ["Alice","Bob","Carol","Dave"]},
  { id: 4,  from: "Dave",    amount: 200.00, to: ["Alice","Bob","Carol","Dave"] },
  { id: 5,  from: "Alice",   amount: 60.00,  to: ["Alice","Carol","Eve"]},
];

function loadMockTransactions() {
  // Clear old data (optional but recommended)
  transactions = [];

  MOCK_EXPENSES.forEach(exp => {
    let to = Array.isArray(exp.to)
      ? exp.to.join(",")
      : exp.to;

    transactions.push({
      from: exp.from,
      to: to,
      amount: exp.amount
    });
  });

  showAlert("📦 Mock data loaded!");

  // Optional UI hint
  document.getElementById("tip").innerText ="Mock dataset loaded. Click 'Next' to see optimization.";
}

// ALERT
function showAlert(msg){
  let box = document.getElementById("alertBox");
  box.innerText = msg;
  box.style.display="block";
  setTimeout(()=>box.style.display="none",4000);
}

// NAVIGATION
function nextScreen(n){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen"+n).classList.add("active");
}

function prevScreen(n){
  nextScreen(n);
}

// ADD
async function addTransaction(){
  let from = document.getElementById("from").value;
  let to = document.getElementById("to").value.split(",").map(s=>s.trim()).join(",");
  let amount = parseFloat(document.getElementById("amount").value);
  let category = document.getElementById("category").value; 

  console.log("Category:", category);

  if(!from||!to||!amount){
    showAlert("⚠️ Fill all fields");
    return;
  }

  let usdAmount = await convertCurrency(amount, "INR", "USD");

  transactions.push({from,to,amount,usd:usdAmount,category});
  showAlert("✅ Added!");

  document.getElementById("tip").innerText =
    `💡 ${amount}₹ ≈ $${usdAmount.toFixed(2)} USD`;
}

// STRATEGY
function setStrategy(s){
  strategy=s;
  showAlert("Strategy: "+s);
}

// BALANCE
function calculateBalances(){
  let b = {};

  transactions.forEach(t => {
    let receivers = Array.isArray(t.to) 
      ? t.to 
      : t.to.split(",").map(s => s.trim());

    b[t.from] = (b[t.from] || 0) - t.amount;

    receivers.forEach(person => {
      b[person] = (b[person] || 0) + t.amount / receivers.length;
    });
  });

  return b;
}

// GREEDY
function minimize(b){
  let res=[];
  let p=Object.keys(b).map(n=>({n,b:b[n]}));

  while(true){
    p.sort((a,b)=>a.b-b.b);
    let d=p[0],c=p[p.length-1];
    if(d.b===0&&c.b===0)break;

    let amt=Math.min(-d.b,c.b);
    d.b+=amt; c.b-=amt;

    res.push({from:d.n,to:c.n,amount:amt});
  }
  return res;
}

// MAIN
function calculate(){
  if(!transactions.length){
    showAlert("Add transactions first!");
    return;
  }

  let before=document.getElementById("before");
  let result=document.getElementById("result");

  before.innerHTML=""; result.innerHTML="";

  transactions.forEach(t=>{
    let li=document.createElement("li");
    li.textContent=`${t.from}→${t.to}: ₹${t.amount} (${t.category || "No category"})`;
    before.appendChild(li);
  });

  let balances=calculateBalances();
  let set=minimize(balances);

  set.forEach((s,i)=>{
    setTimeout(()=>{
      let li=document.createElement("li");
      li.innerHTML=`${s.from} pays ${s.to}: ₹${s.amount}
      <button onclick="this.parentElement.style.textDecoration='line-through'">Pay</button>`;
      result.appendChild(li);
    },i*300);
  });

  document.getElementById("chain").innerText =
    `🔗 ${set.length} debts cleared`;

  let text="";
  for(let p in balances){
    if(balances[p]<0) text+=`${p} owes ₹${-balances[p]}. `;
    else text+=`${p} gets ₹${balances[p]}. `;
  }

  document.getElementById("ai").innerText=text;
  document.getElementById("suggestion").innerText="💡 Direct settlements reduce complexity";
  document.getElementById("insights").innerText="📊 Optimized using greedy algorithm";

  drawChart(balances);
  drawFlow(set);

  showAlert("⚡ Optimized!");
}

// CHART
function drawChart(balances){
  let ctx=document.getElementById("chart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:Object.keys(balances),
      datasets:[{data:Object.values(balances)}]
    },
    options: {plugins: {legend: {labels: {color: "white" }}}}}
  );
}

// FLOW
function drawFlow(set){
  let svg=document.getElementById("flowSvg");
  svg.innerHTML="";
  let cx=130,cy=130,r=90;

  let people=[...new Set(set.flatMap(s=>[s.from,s.to]))];
  let pos={};

  people.forEach((p,i)=>{
    let angle=(i/people.length)*2*Math.PI;
    let x=cx+r*Math.cos(angle);
    let y=cy+r*Math.sin(angle);
    pos[p]={x,y};

    let c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",x);
    c.setAttribute("cy",y);
    c.setAttribute("r",15);
    c.setAttribute("class","node");
    svg.appendChild(c);

    let t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",x);
    t.setAttribute("y",y+4);
    t.setAttribute("text-anchor","middle");
    t.textContent=p;
    svg.appendChild(t);
  });

  set.forEach(s=>{
    let l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",pos[s.from].x);
    l.setAttribute("y1",pos[s.from].y);
    l.setAttribute("x2",pos[s.to].x);
    l.setAttribute("y2",pos[s.to].y);
    l.setAttribute("class","line");
    svg.appendChild(l);
  });
}
async function convertCurrency(amount, from="INR", to="USD"){
  try{
    let res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    let data = await res.json();
    let rate = data.rates[to];
    return amount * rate;
  }catch(err){
    console.error("API Error", err);
    return amount; // fallback
  }
}

function resetAll(){
  // Reset core data
  transactions = [];
  strategy = "fast";

  // Clear inputs
  document.getElementById("from").value = "";
  document.getElementById("to").value = "";
  document.getElementById("amount").value = "";

  // Clear lists
  document.getElementById("before").innerHTML = "";
  document.getElementById("result").innerHTML = "";

  // Clear text outputs
  document.getElementById("ai").innerText = "";
  document.getElementById("chain").innerText = "";
  document.getElementById("suggestion").innerText = "";
  document.getElementById("insights").innerText = "";

  // Clear chart
  if(chart){
    chart.destroy();
    chart = null;
  }

  // Clear flow diagram
  document.getElementById("flowSvg").innerHTML = "";

  showAlert("🔄 Reset complete");
}

async function convertCurrency(amount, from="INR", to="USD"){
  try{
    let res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    let data = await res.json();
    let rate = data.rates[to];
    return amount * rate;
  }catch(err){
    console.error("API Error", err);
    return amount; // fallback
  }
}