'use client';

import { categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import './CategoryFilters.css';

interface CategoryFiltersProps {
  activeCategory: Category | 'All';
  onCategoryChange: (category: Category | 'All') => void;
}

export default function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  return (
    <div className="feed-filters-wrapper">
      <div className="feed-filters-scroll" id="feed-category-filters">
        <button
          className={`feed-filter-pill ${activeCategory === 'All' ? 'active' : ''}`}
          onClick={() => onCategoryChange('All')}
          id="feed-filter-all"
        >
          <span className="filter-emoji">🌎</span>
          <span className="filter-text">All news</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            className={`feed-filter-pill ${activeCategory === cat.name ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.name)}
            id={`feed-filter-${cat.name.toLowerCase()}`}
          >
            <span className="filter-emoji">{cat.emoji}</span>
            <span className="filter-text">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
