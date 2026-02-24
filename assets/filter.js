const yearFilter = document.getElementById("yearFilter");
const statusFilter = document.getElementById("statusFilter");
const cards = document.querySelectorAll(".card");

function filterCards() {
  const year = yearFilter.value;
  const status = statusFilter.value;

  cards.forEach(card => {
    const matchYear = year === "all" || card.dataset.year == year;
    const matchStatus = status === "all" || card.dataset.status === status;

    if (matchYear && matchStatus) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

if (yearFilter && statusFilter) {
  yearFilter.addEventListener("change", filterCards);
  statusFilter.addEventListener("change", filterCards);
}
