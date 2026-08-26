/**
 * One of the rail's drawers.
 *
 * The rail had grown to seven stacked blocks — the seat, the stores, the
 * manpower, the industry, the selected hex, two legends and a line of statistics
 * — in a column three hundred pixels wide. I wrote the industry panel and then
 * had to scroll to find it, which is a fair test and it failed.
 *
 * So everything that is *reference* now lives behind a row of names, one open
 * at a time. What stays out is the one thing that is not reference: the seat,
 * and the button that ends the day. Everything else you go and look at, which
 * is a different verb from working with.
 */
export function Drawers({ open, onOpen, drawers }) {
  const showing = drawers.find((d) => d.id === open);
  return (
    <div className="drawers">
      <div className="drawers__tabs">
        {drawers.map((drawer) => (
          <button
            key={drawer.id}
            type="button"
            className={`drawers__tab${open === drawer.id ? ' is-open' : ''}`}
            onClick={() => onOpen(open === drawer.id ? null : drawer.id)}
          >
            {drawer.name}
          </button>
        ))}
      </div>
      {showing && (
        <div className="drawers__body">
          {showing.note && <p className="drawers__note">{showing.note}</p>}
          {showing.body}
        </div>
      )}
    </div>
  );
}
