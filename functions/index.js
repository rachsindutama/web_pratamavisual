const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const logger = functions.logger;

admin.initializeApp();
const db = admin.firestore();

// Helper to get all admin FCM tokens and Site Settings (like favicon and brand name)
async function getAdminData() {
  const adminSnapshot = await db.collection('users').where('role', '==', 'admin').get();
  const tokens = [];
  let faviconUrl = null;
  let brandName = null;

  for (const doc of adminSnapshot.docs) {
    const data = doc.data();
    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens);
    } else if (data.fcmToken) {
      tokens.push(data.fcmToken);
    }

    if (!faviconUrl || !brandName) {
      const settingsSnap = await db.collection('siteSettings').doc(doc.id).get();
      if (settingsSnap.exists) {
        const settingsData = settingsSnap.data();
        if (!faviconUrl) faviconUrl = settingsData.faviconUrl;
        if (!brandName) brandName = settingsData.brandName;
      }
    }
  }

  // Remove duplicates just in case
  const uniqueTokens = [...new Set(tokens)];
  return { tokens: uniqueTokens, faviconUrl, brandName };
}

// 1. Send to Admin: New Booking or Inquiry
exports.onBookingCreated = functions.region('asia-southeast2').firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tokens: adminTokens, faviconUrl } = await getAdminData();

    if (adminTokens.length === 0) return null;

    const isInquiry = data.status === 'inquiry' || data.bookingMode === 'inquiry';
    const title = isInquiry ? 'Pertanyaan Jadwal Baru!' : 'Booking Baru Masuk!';
    const body = isInquiry
      ? `Klien ${data.fullName || 'Klien'} ingin bertanya ketersediaan jadwal untuk tanggal ${data.eventDate || '-'}.`
      : `${data.fullName || 'Klien'} baru saja memesan paket ${data.packageTitle || 'paket'} untuk tanggal ${data.eventDate || '-'}.`;

    const message = {
      notification: { title, body },
      tokens: adminTokens,
    };
    if (faviconUrl) {
      message.webpush = { notification: { icon: faviconUrl } };
    }

    return admin.messaging().sendEachForMulticast(message).catch(err => logger.error('Failed to send notification:', err));
  });

// 2. Send to Admin: New Testimonial
exports.onTestimonialCreated = functions.region('asia-southeast2').firestore
  .document('testimonials/{testimonialId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tokens: adminTokens, faviconUrl } = await getAdminData();

    if (adminTokens.length === 0) return null;

    const message = {
      notification: {
        title: 'Testimoni Baru!',
        body: `${data.clientName} telah memberikan testimoni. Cek dashboard untuk approve.`,
      },
      tokens: adminTokens,
    };
    if (faviconUrl) {
      message.webpush = { notification: { icon: faviconUrl } };
    }

    return admin.messaging().sendEachForMulticast(message).catch(err => logger.error('Failed to send notification:', err));
  });

// 3. Send to Client: Booking Status Updated
exports.onBookingUpdated = functions.region('asia-southeast2').firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();

    const promises = [];

    // 1. Check if status changed (Notify Client)
    if (newValue.status !== previousValue.status) {
      const userDoc = await db.collection('users').doc(newValue.userId).get();
      const userData = userDoc.data();

      if (userData && (userData.fcmTokens || userData.fcmToken)) {
        let body = `Status booking Anda telah diperbarui menjadi ${newValue.status}.`;
        if (newValue.status === 'pending') body = 'Booking Anda masuk dalam antrean (Pending).';
        else if (newValue.status === 'approved') body = 'Booking Anda telah disetujui (Approved).';
        else if (newValue.status === 'in process') body = 'Pesanan Anda sedang dikerjakan (In Process).';
        else if (newValue.status === 'finished') body = 'Booking Anda telah selesai (Finished).';
        else if (newValue.status === 'rejected') body = 'Mohon maaf, Booking Anda ditolak (Rejected).';
        else if (newValue.status === 'cancelled') body = 'Booking Anda telah dibatalkan (Cancelled).';

        const { faviconUrl } = await getAdminData();
        const clientTokens = (userData.fcmTokens && Array.isArray(userData.fcmTokens)) ? userData.fcmTokens : [userData.fcmToken];

        const message = {
          notification: {
            title: 'Update Status Booking',
            body: body,
          },
          android: { notification: { color: '#D4AF37' } },
          tokens: clientTokens,
        };
        if (faviconUrl) {
          message.webpush = { notification: { icon: faviconUrl } };
        }
        promises.push(admin.messaging().sendEachForMulticast(message).catch(err => logger.error('Failed to send notification:', err)));
      }
    }

    // 2. Check if new payment was added (Notify Admin)
    const prevPayments = previousValue.payments || [];
    const newPayments = newValue.payments || [];

    if (newPayments.length > prevPayments.length) {
      const latestPayment = newPayments[newPayments.length - 1];
      const { tokens: adminTokens, faviconUrl } = await getAdminData();
      if (adminTokens.length > 0 && latestPayment.addedBy !== 'admin') {
        // Filter out the uploading client's tokens so they don't get admin notifications
        let tokensToNotify = adminTokens;
        if (newValue.userId) {
          const clientDoc = await db.collection('users').doc(newValue.userId).get();
          const clientData = clientDoc.exists ? clientDoc.data() : null;
          if (clientData) {
            const clientTokens = (clientData.fcmTokens && Array.isArray(clientData.fcmTokens))
              ? clientData.fcmTokens
              : (clientData.fcmToken ? [clientData.fcmToken] : []);
            tokensToNotify = adminTokens.filter(t => !clientTokens.includes(t));
          }
        }

        if (tokensToNotify.length > 0) {
          const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(latestPayment.amount);
          const message = {
            notification: {
              title: 'Pembayaran Baru Diterima!',
              body: `Klien ${newValue.fullName || 'Klien'} telah mengunggah bukti pembayaran sebesar ${formattedAmount}.`,
            },
            android: { notification: { color: '#D4AF37' } },
            tokens: tokensToNotify,
          };
          if (faviconUrl) {
            message.webpush = { notification: { icon: faviconUrl } };
          }
          promises.push(admin.messaging().sendEachForMulticast(message).catch(err => logger.error('Failed to send multicast notification:', err)));
        }
      }
    }

    // 3. Check if a payment status changed (Notify Client)
    if (newPayments.length === prevPayments.length && newPayments.length > 0) {
      for (let i = 0; i < newPayments.length; i++) {
        const newP = newPayments[i];
        const oldP = prevPayments[i];
        if (oldP && newP.status !== oldP.status) {
          logger.info(`Payment ${newP.id} status changed: ${oldP.status} -> ${newP.status}`);
          const userDoc = await db.collection('users').doc(newValue.userId).get();
          const userData = userDoc.data();
          if (userData && (userData.fcmTokens || userData.fcmToken)) {
            const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(newP.amount);
            let title = 'Update Pembayaran';
            let body = `Status pembayaran ${formattedAmount} Anda telah diperbarui menjadi ${newP.status}.`;
            if (newP.status === 'approved') {
              title = 'Pembayaran Disetujui!';
              body = `Pembayaran Anda sebesar ${formattedAmount} telah disetujui. Terima kasih!`;
            } else if (newP.status === 'rejected') {
              title = 'Pembayaran Ditolak';
              body = `Pembayaran Anda sebesar ${formattedAmount} ditolak. Silakan hubungi admin.`;
            }
            const { faviconUrl } = await getAdminData();
            const clientTokens = (userData.fcmTokens && Array.isArray(userData.fcmTokens)) ? userData.fcmTokens : [userData.fcmToken];

            const message = {
              notification: { title, body },
              android: { notification: { color: '#D4AF37' } },
              tokens: clientTokens,
            };
            if (faviconUrl) {
              message.webpush = { notification: { icon: faviconUrl } };
            }
            promises.push(admin.messaging().sendEachForMulticast(message).catch(err => logger.error('Failed to send payment notification:', err)));
          }
          break;
        }
      }
    }

    if (promises.length === 0) return null;
    return Promise.all(promises);
  });

// 4. Send to Client: Album Updated (photos added or client assigned)
exports.onAlbumUpdated = functions.region('asia-southeast2').firestore
  .document('albums/{albumId}')
  .onUpdate(async (change, context) => {
    const albumId = context.params.albumId;
    const newValue = change.after.data();
    const previousValue = change.before.data();

    const prevPhotoCount = previousValue.photoCount || 0;
    const newPhotoCount = newValue.photoCount || 0;

    // Determine if we should notify the client:
    // Case 1: Photos were added (photoCount increased) AND album has a clientId
    // Case 2: Client was just assigned (clientId changed from empty to a value) AND album already has photos
    const photosAdded = newPhotoCount > prevPhotoCount && newValue.clientId;
    const clientJustAssigned = newValue.clientId && !previousValue.clientId && newPhotoCount > 0;

    if (!photosAdded && !clientJustAssigned) {
      return null;
    }

    const reason = photosAdded ? 'photos added' : 'client assigned to album with existing photos';
    logger.info(`Album notification triggered (${reason}). Album: ${albumId}, clientId: ${newValue.clientId}, photoCount: ${prevPhotoCount} -> ${newPhotoCount}`);

    const userDoc = await db.collection('users').doc(newValue.clientId).get();
    const userData = userDoc.data();

    if (!userData) {
      logger.warn(`User data not found for clientId ${newValue.clientId}`);
      return null;
    }

    if (!userData.fcmTokens && !userData.fcmToken) {
      logger.warn(`User ${newValue.clientId} has no fcmToken. Skipping notification.`);
      return null;
    }

    logger.info(`Sending album notification to user ${newValue.clientId}`);

    const { faviconUrl, brandName } = await getAdminData();
    const vendorName = brandName || 'Vendor';
    const clientTokens = (userData.fcmTokens && Array.isArray(userData.fcmTokens)) ? userData.fcmTokens : [userData.fcmToken];

    const message = {
      notification: {
        title: 'Album Baru Telah Siap!',
        body: `${vendorName} telah mengunggah foto ke album ${newValue.title}. Silakan cek sekarang!`,
      },
      android: { notification: { color: '#D4AF37' } },
      tokens: clientTokens,
    };
    if (faviconUrl) {
      message.webpush = { notification: { icon: faviconUrl } };
    }

    try {
      const result = await admin.messaging().sendEachForMulticast(message);
      logger.info(`Album notification sent successfully: ${result}`);
      return result;
    } catch (err) {
      logger.error(`Failed to send album notification: ${err.message}`, { code: err.code });
      return null;
    }
  });

// TEMPORARY: One-time fix for old albums missing photoCount
exports.fixAlbumPhotoCount = functions.region('asia-southeast2').https.onRequest(async (req, res) => {
  const albumsSnap = await db.collection('albums').get();
  const results = [];

  for (const albumDoc of albumsSnap.docs) {
    const albumData = albumDoc.data();
    const photosSnap = await db.collection('albumPhotos').where('albumId', '==', albumDoc.id).get();
    const actualCount = photosSnap.size;
    const currentCount = albumData.photoCount;

    if (currentCount !== actualCount) {
      await db.collection('albums').doc(albumDoc.id).update({ photoCount: actualCount });
      results.push(`Fixed "${albumData.title}": ${currentCount} -> ${actualCount}`);
    }
  }

  res.json({ fixed: results.length, details: results });
});

// 5. Cloudinary Image Deletion
const cloudinary = require('cloudinary').v2;

// The user must set these via Firebase Functions Config:
// Place them in a .env file inside the functions/ directory.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'd7wlzzdc',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.deleteCloudinaryImage = functions.region('asia-southeast2').https.onCall(async (data, context) => {
  // Ensure user is authenticated and admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete images.');
  }

  const { publicId } = data;
  if (!publicId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "publicId".');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Deleted image ${publicId} from Cloudinary: ${result.result}`);
    return { success: true, result: result.result };
  } catch (error) {
    logger.error(`Failed to delete image ${publicId} from Cloudinary`, error);
    throw new functions.https.HttpsError('internal', 'Failed to delete image from Cloudinary.');
  }
});

// 6. Serve Dynamic SEO (SSR for Open Graph tags)
exports.serveDynamicSEO = functions.region('asia-southeast2').https.onRequest(async (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send('index.html not found. Please build the project first.');
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    // Fetch admin siteSettings
    const adminSnapshot = await db.collection('users').where('role', '==', 'admin').limit(1).get();
    if (!adminSnapshot.empty) {
      const adminId = adminSnapshot.docs[0].id;
      const settingsSnap = await db.collection('siteSettings').doc(adminId).get();

      if (settingsSnap.exists) {
        const settings = settingsSnap.data();

        const title = settings.seoTitle || settings.brandName || '';
        const desc = settings.seoDescription || '';
        let img = settings.portfolioHero?.imageUrl || settings.faviconUrl || '';

        // Cloudinary: optimize image for WhatsApp (under 300KB, 1200x630)
        if (img && img.includes('cloudinary.com/')) {
          img = img.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_80,f_jpg/');
        }

        // Per-page canonical URL — must match actual request path
        const canonicalHost = 'pratamavisual.com';
        const reqPath = req.path || '/';
        const normPath = reqPath === '/' ? '/' : reqPath.replace(/\/$/, '');
        const url = 'https://' + canonicalHost + normPath;

        // Per-page title & description
        const brandTitle = title;
        const pageTitles = {
          '/pricing':    `Pricing \u2014 ${brandTitle}`,
          '/booking':    `Booking \u2014 ${brandTitle}`,
          '/portfolio':  `Portfolio \u2014 ${brandTitle}`,
          '/categories': `Categories \u2014 ${brandTitle}`,
        };
        const pageDescs = {
          '/pricing':    settings.pricingSubtitle || desc,
          '/booking':    settings.contactSubtitle || desc,
        };
        const pageTitle = pageTitles[normPath] || title;
        const pageDesc  = pageDescs[normPath]  || desc;

        html = html
          .replace(/__OG_TITLE__/g, pageTitle)
          .replace(/__OG_DESC__/g,  pageDesc)
          .replace(/__OG_IMAGE__/g, img)
          .replace(/__OG_URL__/g,   url)
          .replace('href="/favicon.svg"', `href="${settings.faviconUrl || '/favicon.svg'}"`);

        // Build JSON-LD entirely from Firestore settings — zero hardcoded values
        const jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          'name': title,
          'description': desc,
          'url': url,
          'image': img,
        };

        // Add phone if set
        if (settings.adminWhatsApp) {
          jsonLd.telephone = '+' + settings.adminWhatsApp;
        }

        // Add address if set
        if (settings.vendorAddress) {
          jsonLd.address = {
            '@type': 'PostalAddress',
            'streetAddress': settings.vendorAddress,
          };
        }

        // Add social links from footerLinks if set
        const igUrl = settings.footerLinks?.instagram?.url;
        if (igUrl && igUrl !== '#') {
          jsonLd.sameAs = [igUrl];
        }

        // Build offer catalog from categories in Firestore
        try {
          const categoriesSnap = await db.collection('categories').orderBy('order', 'asc').limit(10).get();
          if (!categoriesSnap.empty) {
            const offers = categoriesSnap.docs.map(doc => {
              const cat = doc.data();
              return {
                '@type': 'Offer',
                'itemOffered': {
                  '@type': 'Service',
                  'name': cat.name || '',
                  'description': cat.description || cat.name || '',
                },
              };
            });
            jsonLd.hasOfferCatalog = {
              '@type': 'OfferCatalog',
              'name': title,
              'itemListElement': offers,
            };
          }
        } catch (e) {
          // Categories fetch failed, skip offer catalog
        }

        html = html.replace('__JSON_LD__', JSON.stringify(jsonLd));
      }
    }

    // Always clean up any remaining raw placeholders (safety net)
    html = html
      .replace(/__OG_TITLE__/g, '')
      .replace(/__OG_DESC__/g,  '')
      .replace(/__OG_IMAGE__/g, '')
      .replace(/__OG_URL__/g,   '')
      .replace('__JSON_LD__',   '{}');

    // Cache: 5 min browser, 10 min CDN
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(html);
  } catch (error) {
    logger.error('Error serving dynamic SEO:', error);
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      let fallbackHtml = fs.readFileSync(indexPath, 'utf8');
      fallbackHtml = fallbackHtml
        .replace(/__OG_TITLE__/g, '')
        .replace(/__OG_DESC__/g,  '')
        .replace(/__OG_IMAGE__/g, '')
        .replace(/__OG_URL__/g,   '')
        .replace('__JSON_LD__',   '{}');
      res.set('Cache-Control', 'public, max-age=60');
      res.status(200).send(fallbackHtml);
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
});
