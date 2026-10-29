import { useState } from 'react';
import { useFirestoreCollection, orderBy } from '../../hooks/useFirestore';
import { formatDate } from '../../utils/formatDate';
import { motion } from 'framer-motion';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import '../../styles/testimonials.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export default function TestimonialSection() {
  const { settings } = useSiteSettings();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const { data: testimonials, loading } = useFirestoreCollection('testimonials', [
    orderBy('createdAt', 'desc'),
  ]);

  if (loading) {
    return null;
  }

  const approvedTestimonials = testimonials.filter(t => t.status === 'approved');

  if (approvedTestimonials.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(approvedTestimonials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayTestimonials = approvedTestimonials.slice(startIndex, startIndex + itemsPerPage);

  return (
    <section className="testimonials-section">
      <div className="container">
        <motion.div
          className="testimonials-section__header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="heading-2" style={{ marginBottom: '1rem' }}>{settings?.sectionTitles?.testimonials || 'Client Stories'}</h2>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Hear from our wonderful clients about their experiences working with us.
          </p>
        </motion.div>

        <motion.div
          key={currentPage}
          className="testimonials-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {displayTestimonials.map((t) => (
            <motion.div key={t.id} variants={itemVariants} className="testimonial-card">
              <p className="testimonial-card__quote">"{t.message}"</p>
              <div>
                <div className="testimonial-card__author">{t.clientName}</div>
                <div className="testimonial-card__date" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {formatDate(t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt)}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: page === currentPage ? '1px solid var(--color-accent)' : '1px solid #333',
                  background: page === currentPage ? 'var(--color-accent)' : 'transparent',
                  color: page === currentPage ? '#000' : '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
