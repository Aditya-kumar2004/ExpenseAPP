export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-5 h-5 border', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-2' };
  return (
    <div className={`${sizes[size]} border-brand-500 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}
