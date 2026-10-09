// Status card: icon + bada number + label. `variant` se rang aata hai (globals.css → .td-stat-*)
export default function StatCard({ title, value, variant, icon, onClick }) {
    return (
        <button type="button" className={`td-stat td-stat-${variant}`} onClick={onClick}>
            <span className="td-stat-icon">{icon}</span>
            <span className="td-stat-value">{value}</span>
            <span className="td-stat-label">{title}</span>
        </button>
    );
}
