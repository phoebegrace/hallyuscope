(() => {
  const card = document.getElementById('socialCard');
  const photo = document.getElementById('cardPhoto');
  const category = document.getElementById('cardCategory');
  const headline = document.getElementById('cardHeadline');
  const description = document.getElementById('cardDescription');
  const params = new URLSearchParams(location.search);

  const image = params.get('image') || '/assets/editorial/hallyuscope-news.svg';
  const cat = params.get('category') || 'K-POP';
  const title = params.get('headline') || 'Headline goes here';
  const dek = params.get('description') || 'A short description sits naturally below the headline.';

  photo.src = image;
  category.textContent = cat;
  headline.textContent = title;
  description.textContent = dek;

  const hLen = title.trim().length;
  card.dataset.headlineLength =
    hLen > 110 ? 'xlong' :
    hLen > 82 ? 'long' :
    hLen > 58 ? 'medium' : 'short';

  const dLen = dek.trim().length;
  card.dataset.descriptionLength =
    dLen > 190 ? 'xlong' :
    dLen > 135 ? 'long' : 'short';

  function fitToViewport(){
    if(window.innerWidth >= 1128 && window.innerHeight >= 1398){
      card.style.transform = '';
      return;
    }
    const scale = Math.min(
      (window.innerWidth - 32) / 1080,
      (window.innerHeight - 32) / 1350,
      1
    );
    card.style.transform = 'scale(' + scale + ')';
    card.parentElement.style.height = (1350 * scale) + 'px';
  }
  fitToViewport();
  addEventListener('resize', fitToViewport);
})();
