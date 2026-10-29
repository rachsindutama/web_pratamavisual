import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { updateDocument, increment } from '../../hooks/useFirestore';

export default function CategoryLikeButton({ category }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  // Calculate base hardcoded likes as it was originally
  const baseFakeLikesK = ((category.title.length % 5) + 1.2 + (category.title.length * 0.1));
  const baseFakeLikesExact = Math.floor(baseFakeLikesK * 1000);

  useEffect(() => {
    const likedCategories = JSON.parse(localStorage.getItem('likedCategories') || '{}');
    if (likedCategories[category.id]) {
      setIsLiked(true);
    }
    setLikesCount(category.likes || 0);
  }, [category.id, category.likes]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLiked) {
      setIsLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
      
      const likedCategories = JSON.parse(localStorage.getItem('likedCategories') || '{}');
      delete likedCategories[category.id];
      localStorage.setItem('likedCategories', JSON.stringify(likedCategories));
      
      try {
        await updateDocument('categories', category.id, {
          likes: increment(-1)
        });
      } catch (error) {
        console.error("Error unliking:", error);
      }
    } else {
      setIsLiked(true);
      setLikesCount(prev => prev + 1);
      
      const likedCategories = JSON.parse(localStorage.getItem('likedCategories') || '{}');
      likedCategories[category.id] = true;
      localStorage.setItem('likedCategories', JSON.stringify(likedCategories));
      
      try {
        await updateDocument('categories', category.id, {
          likes: increment(1)
        });
      } catch (error) {
        console.error("Error liking:", error);
      }
    }
  };

  const formatLikes = () => {
    const total = baseFakeLikesExact + likesCount;
    return (total / 1000).toFixed(1) + 'K';
  };

  return (
    <div 
      className={`category-card__like ${isLiked ? 'liked' : ''}`} 
      onClick={handleLike}
    >
      <Heart size={14} fill="currentColor" />
      <span>{formatLikes()}</span>
    </div>
  );
}
