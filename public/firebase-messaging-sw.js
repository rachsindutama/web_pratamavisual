importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDtL5Af1Gyrgj7by24gWIDidTVewtyTf70",
  authDomain: "pratamavisual.firebaseapp.com",
  projectId: "pratamavisual",
  storageBucket: "pratamavisual.firebasestorage.app",
  messagingSenderId: "149337703504",
  appId: "1:149337703504:web:189b10cb0a51cc79a97d55"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Firebase automatically shows the notification from the 'notification' payload.
  // Do NOT call showNotification() here or it will cause duplicates.
});


