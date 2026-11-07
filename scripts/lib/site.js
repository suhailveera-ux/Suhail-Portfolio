'use strict';
// Shared site constants, kept in sync with CONFIG.CONTACT in index.html and
// the NAV array in chromeHTML(). If you change contact details or nav items
// on the homepage, mirror the change here too.

const SITE_URL = 'https://suhailbhat07.netlify.app';
const BRAND_NAME = 'Suhail Rashid Bhat';

const CONTACT = {
  phone: '+91 77808 91426',
  phoneHref: 'tel:+917780891426',
  email: 'rashidsuhail573@gmail.com',
  wa: '917780891426',
  location: 'Srinagar, Jammu & Kashmir',
};

const WA_TEXT = 'Hi Suhail, I saw your portfolio and would like to talk campaigns.';
const WA_LINK = `https://wa.me/${CONTACT.wa}?text=${encodeURIComponent(WA_TEXT)}`;

// Same sections as homepage NAV, plus Blog. Keys matching '#id' stay same-page
// anchors on the homepage (so from a blog page they become '/#id').
const NAV = [
  ['top', 'Home'],
  ['about', 'About'],
  ['services', 'Services'],
  ['work', 'Work'],
  ['websites', 'Websites'],
  ['clients', 'Clients'],
  ['experience', 'Experience'],
  ['contact', 'Contact'],
];

module.exports = { SITE_URL, BRAND_NAME, CONTACT, WA_LINK, NAV };
