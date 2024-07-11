/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./views/**/*.{html,ejs}"],
    theme: {
      extend: {
        screens:{
          '4k-low': '1950px',
          '4k-lowminus2': '1350px',
          '4k-mid': '1500px',
          '4k-lowest': '1400px',
          'md-start': '900px',
          'mc-bc': '1000px',
          'md-mid': '740px',
          'md-mid2': '700px',
          'mid-small': '650px',
          'mid-small3': '600px',
          'mid-small2': '500px',
          'mob-ninenine3': '1000px',
          'mob-ninenine4': '1100px',
          'mob-ninenine5': '1150px',
          '4k-midlow': '1800px',
          '450peeeexxx': '450px'
        },
        fontFamily:{
          'poppins': "Poppins, sans-serif",
          'inter': "Inter, sans-serif",
          'tiro-hindi': "Tiro Devanagari Hindi, serif"
        },
      },
    },
    plugins: [],
  }
  
  