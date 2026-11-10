export default function Placeholder({ title, text }) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <div className="card empty">
        <p>{text}</p>
        <span className="badge">Coming soon</span>
      </div>
    </div>
  )
}
