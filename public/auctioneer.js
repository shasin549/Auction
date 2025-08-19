/* Frontend-only room manager using localStorage + storage events.
   Key namespace: "auction_room_<ROOMCODE>"
   Value is JSON with fields: meta, players[], currentIndex, bids[], increment, participants[]
*/
(function(){
  const id = s => document.getElementById(s);

  // panels
  const createRoomPanel = id('createRoomPanel');
  const playerEntryPanel = id('playerEntryPanel');
  const auctionPanel = id('auctionPanel');

  // create room controls
  const roomNameInput = id('roomName');
  const maxParticipantsInput = id('maxParticipants');
  const bidIncrementInput = id('bidIncrement');
  const createRoomBtn = id('createRoomBtn');
  const inviteArea = id('inviteArea');
  const resetLocalBtn = id('resetLocalBtn');

  // player entry controls
  const playerName = id('playerName');
  const playerClub = id('playerClub');
  const playerPosition = id('playerPosition');
  const playerStyle = id('playerStyle');
  const playerValue = id('playerValue');
  const addPlayerBtn = id('addPlayerBtn');
  const startAuctionBtn = id('startAuctionBtn');
  const playerList = id('playerList');

  // auction controls
  const roomDisplay = id('roomDisplay');
  const participantCount = id('participantCount');
  const maxCount = id('maxCount');
  const currentIncrement = id('currentIncrement');
  const currentPlayerCard = id('currentPlayerCard') || id('currentPlayerCard');
  const startBiddingBtn = id('startBiddingBtn');
  const finalCallBtn = id('finalCallBtn');
  const nextPlayerBtn = id('nextPlayerBtn');
  const auctionBids = id('auctionBids');

  let ROOM = null;

  function roomKey(r){ return `auction_room_${r}`; }
  function writeRoom(robj){
    // store and add a tiny timestamp so storage events always fire
    localStorage.setItem(roomKey(ROOM), JSON.stringify({...robj, _ts: Date.now()}));
  }
  function readRoom(){ 
    const raw = localStorage.getItem(roomKey(ROOM));
    return raw ? JSON.parse(raw) : null;
  }

  // UI helpers
  function showPanel(panel){
    [createRoomPanel, playerEntryPanel, auctionPanel].forEach(p=>p.classList.add('hidden'));
    panel.classList.remove('hidden');
  }

  function renderPlayerList(){
    const r = readRoom();
    playerList.innerHTML = '';
    if(!r) return;
    r.players.forEach((pl, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = `<div><strong>${pl.name}</strong><div class="muted">${pl.club} • ${pl.position} • ${pl.style}</div></div><div>${pl.value}</div>`;
      playerList.appendChild(li);
    });
  }

  function renderAuctionPanel(){
    const r = readRoom();
    if(!r) return;
    roomDisplay.textContent = ROOM;
    participantCount.textContent = r.participants.length;
    maxCount.textContent = r.maxParticipants;
    currentIncrement.textContent = r.increment;
    auctionBids.innerHTML = '';
    // show current player if auction started
    if(typeof r.currentIndex === 'number' && r.currentIndex >= 0){
      const player = r.players[r.currentIndex];
      if(player){
        id('currentPlayerCard').innerHTML = `
          <h3>${player.name} <small class="muted">(${player.club})</small></h3>
          <div>Position: ${player.position}</div>
          <div>Style: ${player.style}</div>
          <div>Base: ${player.value}</div>
        `;
      } else {
        id('currentPlayerCard').innerHTML = `<div class="muted">No player</div>`;
      }
      // show bids
      const bids = r.bids || [];
      bids.slice().sort((a,b)=>b.amount - a.amount).forEach(b=>{
        const li = document.createElement('li');
        li.textContent = `${b.name} — ${b.amount}`;
        auctionBids.appendChild(li);
      });
    } else {
      id('currentPlayerCard').innerHTML = `<div class="muted">Auction not started</div>`;
    }
  }

  // create room
  createRoomBtn.addEventListener('click', ()=>{
    const room = roomNameInput.value.trim() || ('R'+Math.floor(1000+Math.random()*9000));
    const maxP = parseInt(maxParticipantsInput.value,10) || 20;
    const inc = parseInt(bidIncrementInput.value,10) || 1;

    ROOM = room;
    const initial = {
      meta: { createdAt: Date.now() },
      maxParticipants: maxP,
      increment: inc,
      participants: [],
      players: [],
      currentIndex: -1, // not started
      bids: []
    };
    writeRoom(initial);

    inviteArea.innerHTML = `Invite link: <a href="${location.origin + location.pathname.replace(/[^\/]*$/, '')}bidder.html?room=${ROOM}">${location.origin + location.pathname.replace(/[^\/]*$/, '')}bidder.html?room=${ROOM}</a> — <span class="muted">open in another tab to test</span>`;
    showPanel(playerEntryPanel);
    renderPlayerList();
  });

  // reset all local rooms (dangerous)
  resetLocalBtn.addEventListener('click', ()=>{
    if(!confirm('Clear all auction_room_* entries from localStorage?')) return;
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('auction_room_')) localStorage.removeItem(k);
    });
    alert('Cleared local auction data.');
  });

  // add player
  addPlayerBtn.addEventListener('click', ()=>{
    const name = playerName.value.trim();
    const club = playerClub.value.trim();
    const position = playerPosition.value.trim();
    const style = playerStyle.value.trim();
    const value = parseInt(playerValue.value,10) || 0;
    if(!ROOM){ alert('Create a room first'); return; }
    if(!name) { alert('Player name required'); return; }

    const r = readRoom();
    r.players.push({ name, club, position, style, value });
    writeRoom(r);
    // clear inputs
    playerName.value=''; playerClub.value=''; playerPosition.value=''; playerStyle.value=''; playerValue.value='';
    renderPlayerList();
  });

  // start auction (from player list)
  startAuctionBtn.addEventListener('click', ()=>{
    const r = readRoom();
    if(!r || r.players.length===0){ alert('Add at least one player'); return; }
    r.currentIndex = 0;
    r.bids = [];
    writeRoom(r);
    showPanel(auctionPanel);
    renderAuctionPanel();
  });

  // auction controls
  startBiddingBtn.addEventListener('click', ()=>{
    // simply mark bidding started - bidders will read currentIndex and allow bids
    const r = readRoom();
    if(!r) return;
    r.bids = []; // reset bids for this player
    writeRoom(r);
    renderAuctionPanel();
  });

  finalCallBtn.addEventListener('click', ()=>{
    const r = readRoom();
    if(!r) return;
    // determine winner from bids
    const bids = r.bids || [];
    const winner = bids.length ? bids.slice().sort((a,b)=>b.amount-a.amount)[0] : null;
    if(winner){
      alert(`Final: Winner ${winner.name} @ ${winner.amount}`);
    } else {
      alert('No bids placed.');
    }
    nextPlayerBtn.classList.remove('hidden');
  });

  nextPlayerBtn.addEventListener('click', ()=>{
    const r = readRoom();
    if(!r) return;
    if(typeof r.currentIndex !== 'number') return;
    r.currentIndex++;
    r.bids = [];
    if(r.currentIndex >= r.players.length){
      alert('All players done.');
      r.currentIndex = -1;
      showPanel(playerEntryPanel);
    } else {
      writeRoom(r);
      renderAuctionPanel();
    }
    nextPlayerBtn.classList.add('hidden');
  });

  // listen for storage updates to re-render participant counts (bidders will write themselves)
  window.addEventListener('storage', (ev)=>{
    if(!ROOM) return;
    if(ev.key === roomKey(ROOM)){
      renderPlayerList();
      renderAuctionPanel();
    } else if(ev.key && ev.key.startsWith('auction_room_')){
      // if someone created a new room elsewhere nothing to do
    }
  });

  // initial render if room param present (let auctioneer open room directly)
  const url = new URL(location.href);
  if(url.searchParams.has('room')){
    ROOM = url.searchParams.get('room');
    const r = readRoom();
    if(r){
      // if room exists show player entry or auction depending on currentIndex
      if(typeof r.currentIndex === 'number' && r.currentIndex >= 0){
        showPanel(auctionPanel);
        renderAuctionPanel();
      } else {
        showPanel(playerEntryPanel);
        renderPlayerList();
      }
      inviteArea.innerHTML = `Invite link: <a href="${location.origin + location.pathname.replace(/[^\/]*$/, '')}bidder.html?room=${ROOM}">${location.origin + location.pathname.replace(/[^\/]*$/, '')}bidder.html?room=${ROOM}</a>`;
    }
  }

})();