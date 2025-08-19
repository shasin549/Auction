/* Bidder-side localStorage sync
   - Join room: adds bidder name to participants array in room object
   - Place bids: append to room.bids array (with timestamp)
   - Listen to storage events to update UI live
*/
(function(){
  const id = s => document.getElementById(s);

  const joinPanel = id('joinPanel');
  const livePanel = id('livePanel');
  const joinBtn = id('joinBtn');
  const bidderNameInput = id('bidderName');
  const roomCodeInput = id('roomCode');

  const roomDisplay = id('roomDisplay');
  const participantCount = id('participantCount');
  const maxCount = id('maxCount');
  const currentIncrement = id('currentIncrement');

  const currentPlayer = id('currentPlayer');
  const manualBidInput = id('manualBid');
  const placeBidBtn = id('placeBidBtn');
  const bidList = id('bidList');
  const status = id('status');

  let ROOM = null;
  let ME = null;

  function roomKey(r){ return `auction_room_${r}`; }
  function readRoom(){ return JSON.parse(localStorage.getItem(roomKey(ROOM)) || 'null'); }
  function writeRoom(obj){ localStorage.setItem(roomKey(ROOM), JSON.stringify({...obj, _ts:Date.now()})); }

  function showLive(){
    joinPanel.classList.add('hidden');
    livePanel.classList.remove('hidden');
  }
  function showJoin(){
    joinPanel.classList.remove('hidden');
    livePanel.classList.add('hidden');
  }

  // auto-fill room from ?room=...
  const url = new URL(location.href);
  if(url.searchParams.has('room')) roomCodeInput.value = url.searchParams.get('room');

  joinBtn.addEventListener('click', ()=>{
    const room = roomCodeInput.value.trim();
    const name = bidderNameInput.value.trim();
    if(!room || !name){ alert('Enter name and room'); return; }
    ROOM = room; ME = name;

    // join: add to participants if not present
    let r = readRoom();
    if(!r){ alert('Room not found or not created yet'); return; }
    if(!r.participants) r.participants = [];
    if(!r.participants.includes(name)){
      r.participants.push(name);
      writeRoom(r);
    }
    status.textContent = 'Joined as ' + name;
    roomDisplay.textContent = ROOM;
    participantCount.textContent = r.participants.length;
    maxCount.textContent = r.maxParticipants;
    currentIncrement.textContent = r.increment;
    renderCurrentPlayer();
    showLive();
  });

  function renderCurrentPlayer(){
    const r = readRoom();
    if(!r){ currentPlayer.innerHTML = '<div class="muted">Waiting for room</div>'; return; }
    participantCount.textContent = r.participants.length;
    maxCount.textContent = r.maxParticipants;
    currentIncrement.textContent = r.increment;
    if(typeof r.currentIndex === 'number' && r.currentIndex >= 0){
      const pl = r.players[r.currentIndex];
      if(pl){
        currentPlayer.innerHTML = `<h3>${pl.name} <small class="muted">(${pl.club})</small></h3>
          <div>Position: ${pl.position}</div>
          <div>Style: ${pl.style}</div>
          <div>Base: ${pl.value}</div>`;
      } else {
        currentPlayer.innerHTML = '<div class="muted">No player</div>';
      }
      renderBids();
    } else {
      currentPlayer.innerHTML = '<div class="muted">Auction not started</div>';
      bidList.innerHTML = '';
    }
  }

  function renderBids(){
    const r = readRoom();
    bidList.innerHTML = '';
    if(!r || !r.bids) return;
    const sorted = r.bids.slice().sort((a,b)=>b.amount - a.amount);
    sorted.forEach(b=>{
      const li = document.createElement('li');
      li.textContent = `${b.name} — ${b.amount}`;
      bidList.appendChild(li);
    });
  }

  placeBidBtn.addEventListener('click', ()=>{
    const r = readRoom();
    if(!r){ alert('Room not available'); return; }
    if(typeof r.currentIndex !== 'number' || r.currentIndex < 0){ alert('No active player'); return; }
    let amount;
    if(manualBidInput.value.trim() !== ''){
      amount = parseInt(manualBidInput.value, 10);
    } else {
      const top = r.bids && r.bids.length ? Math.max(...r.bids.map(b=>b.amount)) : r.players[r.currentIndex].value || 0;
      amount = top + (r.increment || 1);
    }
    if(!amount || amount <= 0){ alert('Invalid bid'); return; }

    const bid = { name: ME, amount, ts: Date.now() };
    r.bids = r.bids || [];
    // remove previous bids by same user to keep only latest (optional)
    r.bids = r.bids.filter(b=>b.name !== ME);
    r.bids.push(bid);
    writeRoom(r);
    manualBidInput.value = '';
    renderBids();
  });

  // storage listener to update UI when auctioneer or other bidders update the room
  window.addEventListener('storage', (ev)=>{
    if(!ROOM) return;
    if(ev.key === roomKey(ROOM)){
      // update UI
      renderCurrentPlayer();
    }
  });

  // if user opens bidder.html with room param and name param, auto-join
  if(url.searchParams.has('room') && url.searchParams.has('name')){
    roomCodeInput.value = url.searchParams.get('room');
    bidderNameInput.value = url.searchParams.get('name');
    joinBtn.click();
  }

})();