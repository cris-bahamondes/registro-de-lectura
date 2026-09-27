import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0 to 5, can be .5
  maxRating?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  interactive = false,
  onRatingChange,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const handleStarClick = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onRatingChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const isHalf = clickX < rect.width / 2;
    const newRating = isHalf ? index + 0.5 : index + 1;
    onRatingChange(newRating === rating ? 0 : newRating);
  };

  return (
    <div className="flex items-center gap-0.5" title={`Valoración: ${rating} de ${maxRating}`}>
      {Array.from({ length: maxRating }).map((_, index) => {
        const starValue = index + 1;
        const isFull = rating >= starValue;
        const isHalf = !isFull && rating >= index + 0.5;

        return (
          <div
            key={index}
            onClick={(e) => handleStarClick(index, e)}
            className={`relative ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          >
            {/* Background empty star */}
            <Star
              className={`${sizeClasses[size]} text-zinc-300 fill-transparent stroke-[1.5]`}
            />

            {/* Filled or Half star overlay */}
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isHalf ? '50%' : '100%' }}
              >
                <Star
                  className={`${sizeClasses[size]} text-zinc-800 fill-zinc-800 stroke-[1.5]`}
                />
              </div>
            )}
          </div>
        );
      })}
      {interactive && (
        <span className="ml-1.5 text-xs font-semibold text-zinc-700">
          {rating > 0 ? rating.toFixed(1) : 'Sin calificar'}
        </span>
      )}
    </div>
  );
};
