import React, { forwardRef } from 'react';
import { Check, Phone, Mail } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatRupiah } from '../../lib/utils';
import { useSiteSettings } from '../../hooks/useSiteSettings';

const StoryTemplate = forwardRef(({ pkg, categoryName }, ref) => {
  const { settings } = useSiteSettings();
  const brandName = settings?.brandName || 'PRATAMAVISUAL';
  const whatsapp = settings?.adminWhatsApp || '+62 812-3456-7890';
  const email = settings?.vendorEmail || 'hello@pratamavisual.com';

  const formatPhoneNumber = (num) => {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      const rest = cleaned.substring(2);
      if (rest.length >= 9) {
        const part1 = rest.substring(0, 3);
        const part2 = rest.substring(3, 7);
        const part3 = rest.substring(7);
        return `(+62) ${part1}-${part2}-${part3}`;
      }
    }
    return num;
  };

  const displayWhatsapp = formatPhoneNumber(whatsapp);

  const priceVal = typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : pkg.price;
  const finalPrice = pkg.discountPercent > 0 ? priceVal * (1 - pkg.discountPercent / 100) : priceVal;

  return (
    <div 
      ref={ref}
      style={{
        width: '1080px',
        height: '1920px',
        background: 'linear-gradient(135deg, #0B0B0B 0%, #1A1A1A 100%)',
        color: '#FFFFFF',
        fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '100px 80px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201, 169, 110, 0.15) 0%, rgba(201, 169, 110, 0) 70%)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201, 169, 110, 0.15) 0%, rgba(201, 169, 110, 0) 70%)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '30px', left: '30px', right: '30px', bottom: '30px', border: '2px solid rgba(201, 169, 110, 0.3)', borderRadius: '30px', pointerEvents: 'none' }} />

      {/* Header / Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", fontSize: '64px', fontWeight: '500', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0, color: '#C9A96E' }}>
          {brandName}
        </h1>
        <p style={{ fontSize: '24px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#A0A0A0', marginTop: '12px', margin: 0 }}>
          Investment & Packages
        </p>
        {categoryName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '30px' }}>
            <div style={{ height: '1px', width: '60px', background: 'rgba(201,169,110,0.4)' }} />
            <span style={{ color: '#C9A96E', fontSize: '22px', textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif", fontWeight: '300' }}>
              {categoryName}
            </span>
            <div style={{ height: '1px', width: '60px', background: 'rgba(201,169,110,0.4)' }} />
          </div>
        )}
      </div>

      {/* Package Card */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(201, 169, 110, 0.2)',
        borderRadius: '32px',
        padding: '60px 50px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backdropFilter: 'blur(20px)',
        zIndex: 1
      }}>

        
        <h2 style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", fontSize: '72px', fontWeight: '500', margin: '0 0 20px 0', textAlign: 'center', color: '#FFFFFF' }}>
          {pkg.title}
        </h2>

        {pkg.discountPercent > 0 && (
          <div style={{ background: '#C9A96E', color: '#000', padding: '6px 20px', borderRadius: '50px', fontSize: '22px', fontWeight: '700', marginBottom: '24px', fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif" }}>
            {pkg.discountPercent}% OFF
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '48px' }}>
          {pkg.discountPercent > 0 && (
            <span style={{ textDecoration: 'line-through', fontSize: '32px', color: '#888', marginBottom: '8px', fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif" }}>
              {formatRupiah(priceVal)}
            </span>
          )}
          <span style={{ fontSize: '72px', fontWeight: '500', fontFamily: "'Cormorant Garamond', 'Georgia', serif", color: '#FFFFFF' }}>
            {formatRupiah(finalPrice)}
          </span>
        </div>

        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {pkg.features?.map((feature, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201, 169, 110, 0.1)', color: '#C9A96E', flexShrink: 0 }}>
                <Check size={20} />
              </div>
              <span style={{ fontSize: '28px', color: '#E0E0E0', lineHeight: 1.4, fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif" }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Contact + QR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '60px', zIndex: 1, fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif", width: '100%', flexShrink: 0 }}>
        
        {/* QR Code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <div style={{ 
            background: '#C9A96E', 
            padding: '16px', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: 'none'
          }}>
            <QRCodeSVG 
              value={`${typeof window !== 'undefined' ? window.location.origin : 'https://pratamavisual.web.app'}/pricing#${pkg.id}`}
              size={130}
              bgColor="transparent"
              fgColor="#0B0B0B"
              level="M"
            />
          </div>
          <span style={{ fontSize: '16px', color: '#888', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: '300' }}>Scan to View</span>
        </div>

        {/* Contact Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '20px' }}>
          <p style={{ fontSize: '18px', color: '#C9A96E', margin: 0, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: '600' }}>Book Your Session Now</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Phone size={26} color="#C9A96E" strokeWidth={1.5} />
            <span style={{ fontSize: '26px', color: '#FFFFFF', fontWeight: '400', letterSpacing: '0.05em' }}>{displayWhatsapp}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={26} color="#C9A96E" strokeWidth={1.5} />
            <span style={{ fontSize: '26px', color: '#FFFFFF', fontWeight: '400', letterSpacing: '0.05em' }}>{email}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

StoryTemplate.displayName = 'StoryTemplate';

export default StoryTemplate;
