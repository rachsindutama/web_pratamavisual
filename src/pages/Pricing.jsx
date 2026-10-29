import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, X, ShoppingCart } from 'lucide-react';
import PricingCard from '../components/ui/PricingCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useFirestoreCollection, orderBy } from '../hooks/useFirestore';
import '../styles/pricing.css';

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSiteSettings();
  const { data: packages, loading: packagesLoading } = useFirestoreCollection(
    'pricingPackages',
    [orderBy('order', 'asc')]
  );
  const { data: categories, loading: categoriesLoading } = useFirestoreCollection(
    'pricingCategories',
    [orderBy('order', 'asc')]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const visiblePackages = packages.filter(pkg => !pkg.isHidden);

  const filteredPackages = visiblePackages.filter((pkg) => {
    const term = searchTerm.toLowerCase();
    const matchName = pkg.title?.toLowerCase().includes(term);
    const categoryName = categories?.find(c => c.id === pkg.categoryId)?.title || '';
    const matchCategorySearch = categoryName.toLowerCase().includes(term);
    const matchFeatures = pkg.features?.some((f) => f.toLowerCase().includes(term));
    const matchSearch = matchName || matchCategorySearch || matchFeatures;
    
    const matchCategoryFilter = selectedCategory === '' || pkg.categoryId === selectedCategory;
    
    return matchSearch && matchCategoryFilter;
  });

  const groupedPackages = [];
  
  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      if (cat.isHidden) return;
      const catPackages = filteredPackages.filter(p => p.categoryId === cat.id);
      if (catPackages.length > 0) {
        groupedPackages.push({
          category: cat,
          packages: catPackages
        });
      }
    });
  }
  
  const uncategorizedPackages = filteredPackages.filter(p => !p.categoryId || !categories?.find(c => c.id === p.categoryId && !c.isHidden));
  if (uncategorizedPackages.length > 0) {
    groupedPackages.push({
      category: { id: 'uncategorized', title: 'Other Packages' },
      packages: uncategorizedPackages
    });
  }

  useEffect(() => {
    if (settings) {
      document.title = settings.seoTitle || settings.brandName || '';
    }
  }, [settings]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!packagesLoading && !categoriesLoading && hash) {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.remove('pricing-card--target');
            void element.offsetWidth; // Force reflow to restart animation
            element.classList.add('pricing-card--target');
            setTimeout(() => element.classList.remove('pricing-card--target'), 2000);
          }, 300);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [packagesLoading, categoriesLoading, location.hash]);

  const handleToggleSelect = (pkg) => {
    setSelectedPackages((prev) => {
      const isSelected = prev.some((p) => p.id === pkg.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== pkg.id);
      } else {
        return [...prev, pkg];
      }
    });
  };

  const handleProceedToBooking = () => {
    navigate('/booking', { state: { preSelectedPackages: selectedPackages } });
  };

  if (packagesLoading || categoriesLoading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div className="pricing-page" id="pricing-page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="pricing-page__title">
            {settings?.pricingTitle || 'Investment'}
          </h1>
          <p className="pricing-page__subtitle">
            {settings?.pricingSubtitle || 'Choose the package that fits your needs. Every moment deserves to be captured beautifully.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', marginBottom: '4rem', padding: '0 1rem' }}
        >
          {/* Search */}
          <div style={{ position: 'relative', width: '100%', flex: '1 1 250px', maxWidth: '400px' }}>
             <Search size={16} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
             <input
               type="text"
               className="form-input"
               placeholder="Search packages..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               style={{ 
                 width: '100%', 
                 padding: '0.85rem 2.5rem 0.85rem 3rem', 
                 borderRadius: 'var(--radius-full)', 
                 backgroundColor: 'transparent',
                 border: '1px solid var(--color-border)',
                 color: 'var(--color-text)',
                 fontSize: '0.95rem',
                 transition: 'border-color 0.2s'
               }}
               onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
               onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
             />
             <div style={{
               position: 'absolute',
               right: '0.75rem',
               top: 0,
               bottom: 0,
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               zIndex: 10,
               pointerEvents: searchTerm ? 'auto' : 'none'
             }}>
               <AnimatePresence>
                 {searchTerm && (
                   <motion.button
                     key="clear-btn"
                     initial={{ opacity: 0, scale: 0.5 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.5 }}
                     transition={{ duration: 0.15 }}
                     onClick={() => setSearchTerm('')}
                     style={{
                       background: 'transparent',
                       border: 'none',
                       color: 'var(--color-text-muted)',
                       cursor: 'pointer',
                       padding: '0.4rem',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       borderRadius: '50%',
                       transition: 'background-color 0.2s, color 0.2s'
                     }}
                     onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                     onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                   >
                     <X size={16} />
                   </motion.button>
                 )}
               </AnimatePresence>
             </div>
          </div>

          {/* Custom Categories Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative', width: '100%', flex: '1 1 200px', maxWidth: '280px' }}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                 width: '100%', 
                 padding: '0.85rem 1.5rem', 
                 borderRadius: 'var(--radius-full)', 
                 backgroundColor: 'rgba(255,255,255,0.02)',
                 border: '1px solid var(--color-border)',
                 color: 'var(--color-text)',
                 fontSize: '0.95rem',
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 cursor: 'pointer',
                 transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-text-muted)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <span style={{ fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '1rem' }}>
                {selectedCategory ? categories?.find(c => c.id === selectedCategory)?.title || 'All Categories' : 'All Categories'}
              </span>
              <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--color-text-muted)', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s ease' }} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#121212',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    zIndex: 50,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    padding: '0.5rem'
                  }}
                >
                  <button
                    onClick={() => { setSelectedCategory(''); setIsDropdownOpen(false); }}
                    style={{
                      width: '100%', padding: '0.75rem 1.25rem', textAlign: 'left', background: selectedCategory === '' ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: selectedCategory === '' ? '#fff' : '#aaa', cursor: 'pointer', fontSize: '0.95rem', borderRadius: '8px', transition: 'all 0.2s', marginBottom: '2px'
                    }}
                    onMouseOver={(e) => { if (selectedCategory !== '') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={(e) => { if (selectedCategory !== '') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa'; } }}
                  >
                    All Categories
                  </button>
                  {categories?.filter(c => !c.isHidden).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setIsDropdownOpen(false); }}
                      style={{
                        width: '100%', padding: '0.75rem 1.25rem', textAlign: 'left', background: selectedCategory === cat.id ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: selectedCategory === cat.id ? '#fff' : '#aaa', cursor: 'pointer', fontSize: '0.95rem', borderRadius: '8px', transition: 'all 0.2s', marginBottom: '2px'
                      }}
                      onMouseOver={(e) => { if (selectedCategory !== cat.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseOut={(e) => { if (selectedCategory !== cat.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa'; } }}
                    >
                      {cat.title}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {groupedPackages.map((group, index) => (
          <div key={group.category.id} style={{ marginBottom: '4rem' }}>
            <motion.div 
              className="pricing-category-header"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 + (index * 0.1) }}
            >
              <div className="pricing-category-line"></div>
              <h2 className="pricing-category-title">
                {group.category.title}
              </h2>
              <div className="pricing-category-line"></div>
            </motion.div>
            <motion.div
              className="pricing-grid"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + (index * 0.1) }}
            >
              {group.packages.map((pkg) => (
                <PricingCard 
                  key={pkg.id} 
                  pkg={pkg} 
                  categoryName={group.category.title}
                  isSelected={selectedPackages.some(p => p.id === pkg.id)}
                  onToggleSelect={handleToggleSelect} 
                />
              ))}
            </motion.div>
          </div>
        ))}

        {visiblePackages.length === 0 ? (
          <motion.p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              padding: '4rem 0',
              fontSize: 'var(--text-sm)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Pricing packages coming soon. Please contact us for a custom quote.
          </motion.p>
        ) : filteredPackages.length === 0 ? (
          <motion.p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              padding: '4rem 0',
              fontSize: 'var(--text-sm)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            No packages match your search.
          </motion.p>
        ) : null}
      </div>

      <motion.div
        initial={{ y: 150, opacity: 0 }}
        animate={{ 
          y: selectedPackages.length > 0 ? 0 : 150, 
          opacity: selectedPackages.length > 0 ? 1 : 0 
        }}
        transition={{ type: 'tween', duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="cart-floating-bar"
        style={{ pointerEvents: selectedPackages.length > 0 ? 'auto' : 'none' }}
      >
        <div className="cart-floating-info">
          <div className="cart-floating-badge">
            {selectedPackages.length}
          </div>
          <span className="cart-floating-text">
            <span className="cart-floating-text-desktop">Packages </span>Selected
          </span>
        </div>
        <button
          className="btn btn-primary cart-floating-btn"
          onClick={handleProceedToBooking}
        >
          <span>Proceed <span className="cart-floating-text-desktop">to Booking</span></span>
        </button>
      </motion.div>
    </div>
  );
}
