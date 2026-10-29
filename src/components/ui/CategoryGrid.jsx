import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import CategoryLikeButton from './CategoryLikeButton';
import { optimizeImageUrl } from '../../lib/utils';
import '../../styles/categories.css';

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: 'easeOut',
    },
  }),
};

export default function CategoryGrid({ categories = [] }) {
  if (categories.length === 0) {
    return null;
  }

  let gridClass = 'category-grid';
  if (categories.length === 1) {
    gridClass += ' category-grid--1col';
  } else if (categories.length === 2 || categories.length === 4) {
    gridClass += ' category-grid--2col';
  } else if (categories.length === 5) {
    gridClass += ' category-grid--5col';
  } else {
    gridClass += ' category-grid--3col';
  }

  return (
    <div className={gridClass}>
      {categories.map((category, index) => (
        <motion.div
          key={category.id}
          className="category-card"
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          custom={index}
        >
          <Link to={`/categories/${category.slug || category.id}`}>
            <div className="category-card__image-wrapper">
              {category.coverImageUrl ? (
                <img
                  src={optimizeImageUrl(category.coverImageUrl, 800)}
                  alt={category.title}
                  className="category-card__image"
                  loading="lazy"
                />
              ) : (
                <div
                  className="category-card__image category-card__placeholder"
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: '1rem', textAlign: 'center' }}
                >
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', margin: 0 }}>Belum ada asset gambar/foto yang ditambahkan.</p>
                </div>
              )}
              <div className="category-card__info">
                <h3 className="category-card__title">{category.title}</h3>
                <CategoryLikeButton category={category} />
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
