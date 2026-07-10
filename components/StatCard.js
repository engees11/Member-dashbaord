export default function StatCard({ title, value, variant, active, onClick }) {
    return (
        <div className={`stat-card stat-${variant} ${active ? 'active' : ''}`} onClick={onClick}>
            <h2>{value}</h2>
            <span>{title}</span>
        </div>
    );
}