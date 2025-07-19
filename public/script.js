document.addEventListener("DOMContentLoaded", () => {
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn = document.getElementById("bidderBtn");
  const appContainer = document.querySelector(".container");
  const roleSelector = document.querySelector(".role-selector");

  // Add ripple effect to buttons
  function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) {
      ripple.remove();
    }

    button.appendChild(circle);
  }

  // Add animation to container
  function animateContainer() {
    appContainer.style.opacity = 0;
    appContainer.style.transform = "translateY(20px)";
    setTimeout(() => {
      appContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      appContainer.style.opacity = 1;
      appContainer.style.transform = "translateY(0)";
    }, 10);
  }

  // Check for return visits
  function checkReturningUser() {
    const lastRole = localStorage.getItem('lastRole');
    if (lastRole) {
      const lastVisit = localStorage.getItem('lastVisit');
      const daysSinceLastVisit = lastVisit ? Math.floor((Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24)) : null;
      
      if (daysSinceLastVisit !== null && daysSinceLastVisit < 7) {
        showWelcomeBackMessage(lastRole, daysSinceLastVisit);
      }
    }
    localStorage.setItem('lastVisit', Date.now().toString());
  }

  function showWelcomeBackMessage(role, days) {
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'welcome-message';
    welcomeMsg.innerHTML = `
      <p>Welcome back! Last time you were a ${role}.</p>
      <small>${days} day${days !== 1 ? 's' : ''} since last visit</small>
    `;
    roleSelector.insertBefore(welcomeMsg, roleSelector.firstChild);
    setTimeout(() => welcomeMsg.classList.add('show'), 100);
  }

  // Handle role selection
  function handleRoleSelection(role, e) {
    createRipple(e);
    
    // Store selection
    localStorage.setItem('lastRole', role);
    
    // Add loading state
    const button = e.currentTarget;
    const originalContent = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Loading...`;
    button.disabled = true;
    
    // Animate transition
    appContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    appContainer.style.opacity = 0;
    appContainer.style.transform = "translateY(-20px)";
    
    setTimeout(() => {
      window.location.href = `${role}.html`;
    }, 300);
    
    // Restore button if navigation fails
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.disabled = false;
    }, 2000);
  }

  // Add event listeners
  auctioneerBtn.addEventListener("click", (e) => handleRoleSelection('auctioneer', e));
  bidderBtn.addEventListener("click", (e) => handleRoleSelection('bidder', e));

  // Add hover effect to buttons
  [auctioneerBtn, bidderBtn].forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
    });
    
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "none";
    });
    
    btn.addEventListener("focus", () => {
      btn.style.outline = "2px solid var(--primary)";
      btn.style.outlineOffset = "2px";
    });
    
    btn.addEventListener("blur", () => {
      btn.style.outline = "none";
    });
  });

  // Initialize
  animateContainer();
  checkReturningUser();

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('ServiceWorker registration successful');
      }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
});