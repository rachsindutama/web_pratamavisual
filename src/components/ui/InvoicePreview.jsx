import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';
import { useFirestoreCollection, orderBy } from '../../hooks/useFirestore';
import { formatRupiah } from '../../lib/utils';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import '../../styles/admin.css';

export default function InvoicePreview({ booking, settings }) {
  const invoiceRef = useRef(null);
  const wrapperRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);
  const { data: packages } = useFirestoreCollection('pricingPackages', [orderBy('order', 'asc')]);
  const { data: categories } = useFirestoreCollection('pricingCategories', [orderBy('order', 'asc')]);

  useEffect(() => {
    const updateScale = () => {
      if (wrapperRef.current) {
        const parentWidth = wrapperRef.current.offsetWidth;
        if (parentWidth < 700) {
          setScale(parentWidth / 700);
        } else {
          setScale(1);
        }
      }
    };
    // Small delay to ensure modal is rendered
    setTimeout(updateScale, 10);
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleDownload = async () => {
    if (!invoiceRef.current) return;

    try {
      setDownloading(true);

      if (document.fonts) {
        await document.fonts.ready;
      }

      // Temporarily set fixed zoom 1 for desktop-style invoice image
      const originalZoom = invoiceRef.current.style.zoom;

      invoiceRef.current.style.zoom = '1';

      // Allow layout to update fully
      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF' // White background
      });

      // Restore responsive styles
      invoiceRef.current.style.zoom = originalZoom;

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      const formattedName = (booking.fullName || 'Client').replace(/\s+/g, '_');
      const invoiceId = booking.id ? booking.id.substring(0, 6) : 'Draft';
      link.download = `Invoice_${formattedName}_${invoiceId}.png`;
      link.click();
    } catch (err) {
      console.error('Error generating invoice:', err);
      alert('Failed to generate invoice image.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Scrollable wrapper so mobile doesn't break */}
      <div
        ref={wrapperRef}
        style={{
          width: '100%',
          overflowX: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: '1rem'
        }}
      >
        <div
          ref={invoiceRef}
          style={{
            margin: '0 auto',
            width: '700px',
            minWidth: '700px',
            maxWidth: '700px',
            background: '#FFFFFF',
            color: '#111111',
            padding: '2rem 3rem',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            fontFamily: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
            position: 'relative',
            textAlign: 'left',
            zoom: scale
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E5E5E5', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontFamily: "'Cormorant Garamond', 'Georgia', serif", letterSpacing: '2px', color: '#111' }}>
                {settings?.brandName || 'PORTFOLIO'}
              </h1>
              {settings?.vendorAddress && (
                <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '0.85rem', maxWidth: '400px', whiteSpace: 'pre-wrap' }}>
                  {settings.vendorAddress}
                </p>
              )}
              {settings?.vendorEmail && (
                <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.85rem' }}>
                  {settings.vendorEmail}
                </p>
              )}
              {settings?.adminWhatsApp && (
                <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.85rem' }}>
                  +{settings.adminWhatsApp}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#111', fontFamily: "'Cormorant Garamond', 'Georgia', serif", fontWeight: 400 }}>INVOICE</h2>
              <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '0.85rem' }}>
                Date: {formatDate(new Date().toISOString())}
              </p>
              {booking.id && (
                <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.85rem' }}>
                  Order ID: #{booking.id.substring(0, 8).toUpperCase()}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Billed To:</h3>
              <p style={{ margin: '0.2rem 0', fontWeight: 'bold', color: '#111' }}>{booking.fullName}</p>
              <p style={{ margin: '0.2rem 0', color: '#444', fontSize: '0.9rem' }}>{booking.email}</p>
              <p style={{ margin: '0.2rem 0', color: '#444', fontSize: '0.9rem' }}>{booking.phone}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Event Details:</h3>
              <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: '#444' }}><strong>Date:</strong> {booking.eventDate}</p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: '#444' }}><strong>Time:</strong> {booking.eventTime}</p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: '#666', maxWidth: '250px', marginLeft: 'auto' }}>{booking.eventAddress}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0', color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0', color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {booking.packagesData && booking.packagesData.length > 0 ? (
                booking.packagesData.map((pkg, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '1rem 0', verticalAlign: 'top' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>{pkg.title}</p>
                      {(pkg.categoryName || categories?.find(c => c.id === pkg.categoryId)?.title) && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>
                          {pkg.categoryName || categories?.find(c => c.id === pkg.categoryId)?.title}
                        </p>
                      )}
                      {pkg.features && pkg.features.length > 0 && (
                        <ul style={{ margin: '0.5rem 0 0 0', padding: 0, fontSize: '0.8rem', color: '#444', listStyle: 'none' }}>
                          {pkg.features.map((feature, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginBottom: '0.2rem', listStyle: 'none' }}>
                              <span style={{ color: '#333', fontSize: '0.9rem', lineHeight: '1.2', fontWeight: 'bold' }}>•</span>
                              <span style={{ lineHeight: '1.4', color: '#444' }}>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0', textAlign: 'right', verticalAlign: 'top' }}>
                      {(pkg.discount > 0 || pkg.discountAmount > 0) ? (
                        <>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#999', fontSize: '0.95rem' }}>
                              {pkg.customPrice !== undefined && pkg.customPrice !== null ? formatRupiah(pkg.customPrice) : formatRupiah(pkg.price)}
                            </span>
                          </div>
                          <div style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            - {formatRupiah(pkg.discount || pkg.discountAmount)} {pkg.discountPercent ? `(${pkg.discountPercent}%)` : ''}
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#10B981', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                            {formatRupiah(pkg.finalPrice !== undefined ? pkg.finalPrice : ((pkg.customPrice !== undefined && pkg.customPrice !== null ? pkg.customPrice : pkg.price) - (pkg.discount || pkg.discountAmount || 0)))}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 'bold', color: '#111', fontSize: '0.95rem' }}>
                          {pkg.customPrice !== undefined && pkg.customPrice !== null ? formatRupiah(pkg.customPrice) : formatRupiah(pkg.price)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : booking.packageIds && packages && packages.length > 0 ? (
                // Legacy booking mapping
                booking.packageIds.map((id, idx) => {
                  const pkg = packages.find(p => p.id === id);
                  if (!pkg) return null;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <td style={{ padding: '1rem 0', verticalAlign: 'top' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>{pkg.title}</p>
                        {categories?.find(c => c.id === pkg.categoryId)?.title && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>
                            {categories.find(c => c.id === pkg.categoryId).title}
                          </p>
                        )}
                        {pkg.features && pkg.features.length > 0 && (
                          <ul style={{ margin: '0.5rem 0 0 0', padding: 0, fontSize: '0.8rem', color: '#444', listStyle: 'none' }}>
                            {pkg.features.map((feature, i) => (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginBottom: '0.2rem', listStyle: 'none' }}>
                                <span style={{ color: '#333', fontSize: '0.9rem', lineHeight: '1.2', fontWeight: 'bold' }}>•</span>
                                <span style={{ lineHeight: '1.4', color: '#444' }}>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 'bold', color: '#111', verticalAlign: 'top' }}>
                        {formatRupiah(pkg.price)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <td style={{ padding: '1rem 0', verticalAlign: 'top' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>Service Package</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>{booking.packageTitle}</p>
                  </td>
                  <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 'bold', color: '#111', verticalAlign: 'top' }}>
                    {formatRupiah(booking.packagePrice)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #E5E5E5' }}>
                <span style={{ color: '#666', fontWeight: 'bold' }}>Subtotal</span>
                <span style={{ fontWeight: 'bold' }}>{formatRupiah(booking.subtotalPrice || booking.packagePrice)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #E5E5E5' }}>
                <span style={{ color: '#666', fontWeight: 'bold' }}>Pajak PPh ({booking.pphPercentage || 0}%)</span>
                <span style={{ fontWeight: 'bold' }}>{formatRupiah(booking.pphAmount || 0)}</span>
              </div>

              {(() => {
                const payments = booking.payments || [
                  {
                    id: 'dp-legacy',
                    amount: booking.paymentAmount || 0,
                    status: booking.status === 'approved' ? 'approved' : 'pending',
                    note: booking.paymentType === 'dp' ? 'Down Payment (DP)' : 'Full Payment (Lunas)'
                  }
                ];

                const totalPaid = payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
                const totalDue = booking.packagePrice - totalPaid;

                return (
                  <>
                    {payments.map((p, idx) => (
                      <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #E5E5E5', fontSize: '0.9rem' }}>
                        <span style={{ color: '#666', display: 'flex', flexDirection: 'column' }}>
                          <span>Payment: {p.note || 'Payment'}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: p.status === 'approved' ? '#10B981' : p.status === 'rejected' ? '#EF4444' : '#F59E0B' }}>
                            Status: {p.status.toUpperCase()}
                          </span>
                          {p.createdAt && (
                            <span style={{ fontSize: '0.65rem', color: '#999', marginTop: '0.1rem' }}>
                              {formatDateTime(p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : p.createdAt)}
                            </span>
                          )}
                        </span>
                        <span style={{ color: p.status === 'approved' ? '#10B981' : '#666' }}>
                          {p.status === 'approved' ? '-' : ''} {formatRupiah(p.amount)}
                        </span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      <span style={{ color: totalDue < 0 ? '#10B981' : '#111' }}>
                        {totalDue < 0 ? 'Overpaid' : 'Total Due'}
                      </span>
                      <span style={{ color: totalDue < 0 ? '#10B981' : '#111' }}>
                        {totalDue < 0 ? `+ ${formatRupiah(Math.abs(totalDue))}` : formatRupiah(totalDue)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div style={{ marginTop: '3rem', textAlign: 'center', borderTop: '1px solid #E5E5E5', paddingTop: '1.5rem' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Thank you for your business!</p>
            <p style={{ margin: '0.25rem 0 0', color: '#555', fontSize: '0.75rem' }}>
              Booking Status: <strong style={{ color: '#111', textTransform: 'uppercase' }}>{booking.status.toUpperCase()}</strong>
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem 0 2rem', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 8px 25px rgba(0,0,0,0.4)', borderRadius: '50px', padding: '0.75rem 2rem', pointerEvents: 'auto' }}
        >
          <Download size={18} />
          {downloading ? 'Generating PNG...' : 'Download Invoice as PNG'}
        </button>
      </div>
    </div>
  );
}
